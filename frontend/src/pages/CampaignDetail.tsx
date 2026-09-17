import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import type { Campaign, CampaignDashboard, CampaignMessage, CampaignProgress, Department } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../auth/AuthContext';
import AssignWorkForm from '../components/AssignWorkForm';
import { BarChart, DonutChart } from '../components/Charts';

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#a89a7c',
  MEDIUM: '#e8b923',
  HIGH: '#c1622b',
  URGENT: '#c0432b',
};

const canManage = ['ADMIN', 'GMA', 'AGM', 'MANAGER', 'COORDINATOR'];
const canAssignRoles = ['GMA', 'AGM', 'COORDINATOR', 'MANAGER', 'ADMIN'];

// Client-side warning threshold, matching the server's hard cap (see README
// "Attachment storage tradeoff" — attachments are stored inline as base64).
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Candidate mimeTypes for MediaRecorder, in preference order. iOS/iPadOS
// Safari (14.3+) records audio but does NOT support the `audio/webm` family
// that Chrome/Firefox default to — it only supports MP4-wrapped audio
// (`audio/mp4`, often reported by MediaRecorder.isTypeSupported as
// `audio/mp4;codecs=mp4a.40.2` for AAC). Chromium-based browsers support
// `audio/webm` (opus) but not `audio/mp4`. We probe with
// MediaRecorder.isTypeSupported() at record time rather than assuming a
// single browser's behavior, and fall back to letting the browser pick its
// own default (passing no mimeType) if none of the candidates report as
// supported, so recording still works even if our list is incomplete.
const AUDIO_MIME_CANDIDATES = [
  'audio/mp4', // Safari (iOS/iPadOS/macOS) default supported container
  'audio/webm;codecs=opus', // Chrome/Firefox/Edge
  'audio/webm',
  'audio/aac',
  'audio/ogg;codecs=opus',
];

function pickAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  return AUDIO_MIME_CANDIDATES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
}

function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('aac')) return 'aac';
  if (mime.includes('ogg')) return 'ogg';
  return 'audio';
}

// Cap recording duration rather than trying to track base64 size live while
// still recording — a simpler, robust proxy for staying under the 3MB
// attachment cap (typical compressed voice audio at ~16-32kbps is well
// under 3MB for 2 minutes; see README "Voice messages").
const MAX_RECORDING_MS = 2 * 60 * 1000;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function AttachmentPreview({ m }: { m: CampaignMessage }) {
  if (!m.attachmentData) return null;
  const isImage = m.attachmentType?.startsWith('image/');
  const isAudio = m.attachmentType?.startsWith('audio/');
  if (isImage) {
    return (
      <a href={m.attachmentData} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 4 }}>
        <img
          src={m.attachmentData}
          alt={m.attachmentName ?? 'attachment'}
          style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 6, display: 'block' }}
        />
      </a>
    );
  }
  if (isAudio) {
    return (
      <audio controls src={m.attachmentData} style={{ display: 'block', marginTop: 4, maxWidth: '100%' }}>
        Your browser does not support audio playback.
      </audio>
    );
  }
  return (
    <a
      href={m.attachmentData}
      download={m.attachmentName ?? 'attachment'}
      style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, fontSize: 13, wordBreak: 'break-all' }}
    >
      📎 {m.attachmentName ?? 'Download attachment'}
    </a>
  );
}

function ChatPanel({ campaignId, onClose }: { campaignId: string; onClose?: () => void }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<CampaignMessage[]>([]);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceMime, setVoiceMime] = useState<string>('');
  const [voiceUrl, setVoiceUrl] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function clearRecordTimer() {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function startRecording() {
    setError('');
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported on this device/browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickAudioMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const actualMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(recordedChunksRef.current, { type: actualMime });
        setVoiceBlob(blob);
        setVoiceMime(actualMime);
        setVoiceUrl(URL.createObjectURL(blob));
        stopStream();
        clearRecordTimer();
        setIsRecording(false);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => {
          const next = s + 1;
          if (next * 1000 >= MAX_RECORDING_MS) {
            mediaRecorderRef.current?.stop();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      setError('Microphone access was denied or unavailable. Check Safari settings and allow microphone access for this site.');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  function cancelRecording() {
    // Discard: stop the recorder without keeping the resulting blob.
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = () => {
        stopStream();
      };
      mediaRecorderRef.current.stop();
    } else {
      stopStream();
    }
    clearRecordTimer();
    setIsRecording(false);
    setRecordSeconds(0);
  }

  function discardVoice() {
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    setVoiceBlob(null);
    setVoiceMime('');
    setVoiceUrl('');
  }

  useEffect(() => {
    return () => {
      clearRecordTimer();
      stopStream();
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function load() {
    api.get(`/campaigns/${campaignId}/messages`).then((r) => setMessages(r.data)).catch(() => {});
  }

  function startEdit(m: CampaignMessage) {
    setEditingId(m.id);
    setEditText(m.text ?? '');
  }

  async function saveEdit(messageId: string) {
    await api.patch(`/campaigns/${campaignId}/messages/${messageId}`, { text: editText });
    setEditingId(null);
    load();
  }

  async function deleteMessage(messageId: string) {
    await api.delete(`/campaigns/${campaignId}/messages/${messageId}`);
    load();
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
  }, [campaignId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length]);

  function onFileChosen(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setError('');
    if (f && f.size > MAX_ATTACHMENT_BYTES) {
      setError(`File too large — max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB.`);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setFile(f);
  }

  async function send(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!text.trim() && !file && !voiceBlob) return;
    setSending(true);
    setError('');
    try {
      const payload: Record<string, unknown> = {};
      if (text.trim()) payload.text = text.trim();
      if (voiceBlob) {
        if (voiceBlob.size > MAX_ATTACHMENT_BYTES) {
          setError(`Voice message too large — max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB. Try a shorter recording.`);
          setSending(false);
          return;
        }
        payload.attachmentName = `voice-message.${extensionForMime(voiceMime)}`;
        payload.attachmentType = voiceMime || 'audio/webm';
        payload.attachmentData = await blobToDataUrl(voiceBlob);
      } else if (file) {
        payload.attachmentName = file.name;
        payload.attachmentType = file.type || 'application/octet-stream';
        payload.attachmentData = await fileToDataUrl(file);
      }
      await api.post(`/campaigns/${campaignId}/messages`, payload);
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      discardVoice();
      load();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card chat-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>Campaign Chat</strong>
        {onClose && (
          <button type="button" className="btn secondary small chat-close-btn" onClick={onClose} aria-label="Close chat">
            ✕
          </button>
        )}
      </div>
      <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
        {messages.map((m) => {
          const isMine = m.userId === user?.id;
          return (
            <div key={m.id} style={{ background: isMine ? '#eaf1ff' : '#f4f5f7', borderRadius: 6, padding: '6px 8px' }}>
              <div style={{ fontSize: 12, color: '#666', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span><strong>{m.user.name}</strong>{m.user.department ? ` · ${m.user.department.name}` : ''}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {isMine && editingId !== m.id && (
                    <>
                      {m.text && (
                        <button type="button" className="chat-msg-action" title="Edit" onClick={() => startEdit(m)}>✎</button>
                      )}
                      <button type="button" className="chat-msg-action" title="Delete" onClick={() => deleteMessage(m.id)}>🗑</button>
                    </>
                  )}
                </span>
              </div>
              {editingId === m.id ? (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    style={{ flex: 1, fontSize: 14 }}
                    autoFocus
                  />
                  <button type="button" className="btn small" onClick={() => saveEdit(m.id)}>Save</button>
                  <button type="button" className="btn secondary small" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                m.text && <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{m.text}</div>
              )}
              <AttachmentPreview m={m} />
            </div>
          );
        })}
        {messages.length === 0 && <p style={{ color: '#888' }}>No messages yet.</p>}
        <div ref={bottomRef} />
      </div>
      {error && <div className="error-text" style={{ marginTop: 6 }}>{error}</div>}
      {file && (
        <div style={{ fontSize: 12, color: '#666', marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          📎 {file.name}
          <button type="button" className="btn secondary small" onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
            Remove
          </button>
        </div>
      )}

      {isRecording && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#fdeaea',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: '#e11d48',
              flexShrink: 0,
              animation: 'pulse 1s infinite',
            }}
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Recording… {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
          </span>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn secondary"
            style={{ minHeight: 44, minWidth: 44, padding: '8px 14px' }}
            onClick={cancelRecording}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn"
            style={{ minHeight: 44, minWidth: 44, padding: '8px 14px', background: '#e11d48', borderColor: '#e11d48' }}
            onClick={stopRecording}
          >
            Stop
          </button>
        </div>
      )}

      {!isRecording && voiceBlob && voiceUrl && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
            padding: '10px 12px',
            borderRadius: 8,
            background: '#eef2ff',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 13 }}>🎤 Voice message ready</span>
          <audio controls src={voiceUrl} style={{ maxWidth: 220 }} />
          <div style={{ flex: 1 }} />
          <button type="button" className="btn secondary small" style={{ minHeight: 40 }} onClick={discardVoice}>
            Re-record
          </button>
        </div>
      )}

      <form onSubmit={send} style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        <textarea
          placeholder="Type a message…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(e);
            }
          }}
          rows={1}
          ref={textareaRef}
          className="chat-textarea"
          style={{ flex: '1 1 160px' }}
          disabled={isRecording}
        />
        <input
          ref={fileInputRef}
          type="file"
          id={`chat-file-${campaignId}`}
          style={{ display: 'none' }}
          onChange={onFileChosen}
        />
        <label
          htmlFor={`chat-file-${campaignId}`}
          className="btn secondary small"
          style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', opacity: isRecording ? 0.5 : 1, pointerEvents: isRecording ? 'none' : 'auto' }}
          title="Attach a file"
        >
          📎
        </label>
        <button
          type="button"
          className="btn secondary small"
          style={{ display: 'flex', alignItems: 'center', minWidth: 44, minHeight: 44 }}
          title={isRecording ? 'Recording…' : 'Record a voice message'}
          disabled={isRecording}
          onClick={startRecording}
        >
          🎙️
        </button>
        <button className="btn small" disabled={sending || isRecording}>Send</button>
      </form>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}

export default function CampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [dashboard, setDashboard] = useState<CampaignDashboard | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  function reload() {
    api.get(`/campaigns/${id}`).then((r) => setCampaign(r.data)).catch((e) => {
      if (e?.response?.status === 403) setForbidden(true);
    });
    api.get(`/campaigns/${id}/progress`).then((r) => setProgress(r.data)).catch(() => {});
    api.get(`/campaigns/${id}/dashboard`).then((r) => setDashboard(r.data)).catch(() => {});
  }

  useEffect(() => {
    reload();
    api.get('/departments').then((r) => setDepartments(r.data));
  }, [id]);

  async function attachDepartment(e: FormEvent) {
    e.preventDefault();
    if (!selectedDept) return;
    await api.post(`/campaigns/${id}/departments`, { departmentId: selectedDept });
    setSelectedDept('');
    reload();
  }

  if (forbidden) return <p>You do not have access to this campaign.</p>;
  if (!campaign) return <p>Loading…</p>;

  const attachedIds = new Set(campaign.departments.map((d) => d.department.id));
  const available = departments.filter((d) => !attachedIds.has(d.id));
  const involvedDepartments = campaign.departments.map((d) => d.department);
  const canAddTask = !!user && (canAssignRoles.includes(user.role) || campaign.coordinatorId === user.id);

  return (
    <div className="campaign-detail-grid">
      <div>
        <div className="section-title">
          <h2>{campaign.name} <span style={{ color: '#888', fontWeight: 400 }}>({campaign.campaignNumber})</span></h2>
          <span className="badge">{campaign.status}</span>
        </div>
        <div className="card" style={{ marginBottom: 20 }}>
          <p>{campaign.description}</p>
          <div className="form-grid">
            <div><strong>Campaign Number:</strong> {campaign.campaignNumber}</div>
            <div><strong>Code:</strong> {campaign.code}</div>
            <div><strong>Coordinator:</strong> {campaign.coordinator?.name}</div>
            <div><strong>Priority:</strong> {campaign.priority}</div>
            <div><strong>Dates:</strong> {new Date(campaign.startDate).toLocaleDateString()} – {new Date(campaign.endDate).toLocaleDateString()}</div>
          </div>
        </div>

        {dashboard && (
          <>
            <div className="section-title">
              <h2>Campaign Dashboard</h2>
            </div>
            <div className="kpi-grid">
              <div className="kpi-card"><div className="value">{dashboard.kpis.total}</div><div className="label">Total tasks</div></div>
              <div className="kpi-card"><div className="value">{dashboard.kpis.completed}</div><div className="label">Completed</div></div>
              <div className="kpi-card"><div className="value">{dashboard.kpis.inProgress}</div><div className="label">In progress</div></div>
              <div className="kpi-card"><div className="value">{dashboard.kpis.pending}</div><div className="label">Pending</div></div>
              <div className="kpi-card"><div className="value">{dashboard.kpis.overdue}</div><div className="label">Overdue</div></div>
              <div className="kpi-card"><div className="value">{dashboard.kpis.completionPercent}%</div><div className="label">Completion</div></div>
            </div>

            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(260px, 1fr)', gap: 16, marginTop: 8, marginBottom: 20 }}>
              <div className="card">
                <strong>Task Status Breakdown</strong>
                <div style={{ marginTop: 10 }}>
                  <DonutChart
                    data={[
                      { label: 'Completed', value: dashboard.kpis.completed, color: '#241f18' },
                      { label: 'Pending', value: dashboard.kpis.pending - dashboard.kpis.overdue, color: '#a89a7c' },
                      { label: 'Overdue', value: dashboard.kpis.overdue, color: '#c0432b' },
                    ]}
                  />
                </div>
              </div>
              <div className="card">
                <strong>Department-wise Completion</strong>
                <div style={{ marginTop: 10 }}>
                  <BarChart data={dashboard.departmentCompletion.map((d) => ({ label: d.name, value: d.completionPercent }))} />
                </div>
              </div>
              <div className="card">
                <strong>Staff Workload</strong>
                <div style={{ marginTop: 10 }}>
                  <BarChart data={dashboard.staffWorkload.slice(0, 8).map((s) => ({ label: s.name, value: s.total }))} />
                </div>
              </div>
              <div className="card">
                <strong>Priority Breakdown</strong>
                <div style={{ marginTop: 10 }}>
                  <BarChart
                    data={dashboard.priorityBreakdown.map((p) => ({
                      label: p.priority,
                      value: p.count,
                      color: PRIORITY_COLORS[p.priority],
                    }))}
                  />
                </div>
              </div>
            </div>
          </>
        )}

        <div className="section-title">
          <h2>Department Progress</h2>
          {canAddTask && (
            <button className="btn" onClick={() => setShowAddTask((v) => !v)}>{showAddTask ? 'Cancel' : 'Add Task'}</button>
          )}
        </div>

        {showAddTask && canAddTask && (
          <AssignWorkForm
            departments={involvedDepartments}
            workType="CAMPAIGN"
            campaignId={campaign.id}
            onDone={() => { setShowAddTask(false); reload(); }}
            onCancel={() => setShowAddTask(false)}
          />
        )}

        {progress?.departments.length === 0 && <p>No departments attached yet.</p>}
        {progress?.departments.map((d) => (
          <div className="card" key={d.department.id} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <strong>{d.department.name}</strong>
              <span>{d.completionPercent}% ({d.completedCount}/{d.taskCount} tasks completed)</span>
            </div>
            <div className="progress-bar"><div style={{ width: `${d.completionPercent}%` }} /></div>
            {d.tasks.length > 0 && (
              <div className="table-scroll">
              <table style={{ marginTop: 10 }}>
                <thead><tr><th>Task</th><th>Assigned To</th><th>Due</th><th>Status</th></tr></thead>
                <tbody>
                  {d.tasks.map((t) => (
                    <tr key={t.id}>
                      <td><Link to={`/tasks/${t.id}`}>{t.title}</Link></td>
                      <td>{t.assignedTo}</td>
                      <td>{new Date(t.dueDate).toLocaleDateString()}</td>
                      <td><StatusBadge status={t.status} overdue={t.overdue} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        ))}

        {user && canManage.includes(user.role) && available.length > 0 && (
          <form className="card" onSubmit={attachDepartment}>
            <strong>Attach a department</strong>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select value={selectedDept} onChange={(e) => setSelectedDept(e.target.value)}>
                <option value="">Select department</option>
                {available.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="btn small">Attach</button>
            </div>
          </form>
        )}
      </div>

      <div className={`chat-panel-wrap${chatOpen ? ' open' : ''}`}>
        <ChatPanel campaignId={campaign.id} onClose={() => setChatOpen(false)} />
      </div>

      <button
        type="button"
        className="chat-fab"
        onClick={() => setChatOpen(true)}
        aria-label="Open campaign chat"
        title="Campaign Chat"
      >
        💬
      </button>
    </div>
  );
}
