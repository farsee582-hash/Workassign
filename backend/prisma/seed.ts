import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

async function main() {
  const deptDefs = [
    { name: 'Marketing', subs: ['Digital Marketing', 'Content'] },
    { name: 'Finance', subs: ['Accounts', 'Payroll'] },
    { name: 'HR', subs: ['Recruitment', 'Employee Relations'] },
    { name: 'Purchase', subs: ['Vendor Management'] },
    { name: 'IT', subs: ['Support', 'Development'] },
  ];

  const departments: Record<string, { id: string }> = {};
  const subDepartments: Record<string, { id: string }> = {};

  for (const d of deptDefs) {
    const dept = await prisma.department.upsert({
      where: { name: d.name },
      create: { name: d.name, description: `${d.name} department` },
      update: {},
    });
    departments[d.name] = dept;
    for (const subName of d.subs) {
      const sub = await prisma.subDepartment.upsert({
        where: { departmentId_name: { departmentId: dept.id, name: subName } },
        create: { name: subName, departmentId: dept.id },
        update: {},
      });
      subDepartments[`${d.name}/${subName}`] = sub;
    }
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    create: {
      employeeId: 'EMP001',
      name: 'Anitha George',
      email: 'admin@workassign.local',
      mobile: '9000000001',
      departmentId: departments.Marketing.id,
      designation: 'General Manager - Administration',
      role: 'GMA',
      username: 'admin',
      passwordHash: await hash('Admin@123'),
      permissionLevel: 10,
    },
    update: {},
  });

  const marketingManager = await prisma.user.upsert({
    where: { username: 'mktg.manager' },
    create: {
      employeeId: 'EMP002',
      name: 'Rahul Nair',
      email: 'rahul.nair@workassign.local',
      mobile: '9000000002',
      departmentId: departments.Marketing.id,
      subDepartmentId: subDepartments['Marketing/Digital Marketing'].id,
      designation: 'Marketing Manager',
      role: 'MANAGER',
      reportingManagerId: admin.id,
      username: 'mktg.manager',
      passwordHash: await hash('Manager@123'),
      permissionLevel: 6,
    },
    update: {},
  });

  const financeManager = await prisma.user.upsert({
    where: { username: 'fin.manager' },
    create: {
      employeeId: 'EMP003',
      name: 'Priya Menon',
      email: 'priya.menon@workassign.local',
      mobile: '9000000003',
      departmentId: departments.Finance.id,
      designation: 'Finance Manager',
      role: 'MANAGER',
      reportingManagerId: admin.id,
      username: 'fin.manager',
      passwordHash: await hash('Manager@123'),
      permissionLevel: 6,
    },
    update: {},
  });

  const exec1 = await prisma.user.upsert({
    where: { username: 'exec.arun' },
    create: {
      employeeId: 'EMP004',
      name: 'Arun Kumar',
      email: 'arun.kumar@workassign.local',
      mobile: '9000000004',
      departmentId: departments.Marketing.id,
      subDepartmentId: subDepartments['Marketing/Content'].id,
      designation: 'Marketing Executive',
      role: 'EXECUTIVE',
      reportingManagerId: marketingManager.id,
      username: 'exec.arun',
      passwordHash: await hash('Exec@123'),
      permissionLevel: 2,
    },
    update: {},
  });

  const exec2 = await prisma.user.upsert({
    where: { username: 'exec.divya' },
    create: {
      employeeId: 'EMP005',
      name: 'Divya Suresh',
      email: 'divya.suresh@workassign.local',
      mobile: '9000000005',
      departmentId: departments.Finance.id,
      subDepartmentId: subDepartments['Finance/Accounts'].id,
      designation: 'Finance Executive',
      role: 'EXECUTIVE',
      reportingManagerId: financeManager.id,
      username: 'exec.divya',
      passwordHash: await hash('Exec@123'),
      permissionLevel: 2,
    },
    update: {},
  });

  const campaign = await prisma.campaign.upsert({
    where: { code: 'ONAM-2026' },
    create: {
      code: 'ONAM-2026',
      campaignNumber: 'CAM-2026-001',
      name: 'Onam Campaign 2026',
      type: 'Seasonal',
      description: 'Onam festival promotional campaign across departments',
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-09-15'),
      coordinatorId: marketingManager.id,
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      notes: 'Coordinated campaign across Marketing and Finance',
    },
    update: {},
  });

  await prisma.campaignDepartment.upsert({
    where: { campaignId_departmentId: { campaignId: campaign.id, departmentId: departments.Marketing.id } },
    create: { campaignId: campaign.id, departmentId: departments.Marketing.id },
    update: {},
  });
  await prisma.campaignDepartment.upsert({
    where: { campaignId_departmentId: { campaignId: campaign.id, departmentId: departments.Finance.id } },
    create: { campaignId: campaign.id, departmentId: departments.Finance.id },
    update: {},
  });

  const taskDefs = [
    {
      taskId: 'T-ONAM-001',
      title: 'Design Onam creatives',
      workType: 'CAMPAIGN' as const,
      campaignId: campaign.id,
      departmentId: departments.Marketing.id,
      subDepartmentId: subDepartments['Marketing/Content'].id,
      assignedToId: exec1.id,
      createdById: marketingManager.id,
      startDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-15'),
      priority: 'HIGH' as const,
      status: 'IN_PROGRESS' as const,
      completionPercent: 40,
    },
    {
      taskId: 'T-ONAM-002',
      title: 'Approve Onam campaign budget',
      workType: 'CAMPAIGN' as const,
      campaignId: campaign.id,
      departmentId: departments.Finance.id,
      subDepartmentId: subDepartments['Finance/Accounts'].id,
      assignedToId: exec2.id,
      createdById: financeManager.id,
      startDate: new Date('2026-08-01'),
      dueDate: new Date('2026-08-10'),
      priority: 'URGENT' as const,
      status: 'ASSIGNED' as const,
      completionPercent: 0,
    },
    {
      taskId: 'T-DAILY-001',
      title: 'Daily social media posting',
      workType: 'DAILY' as const,
      departmentId: departments.Marketing.id,
      subDepartmentId: subDepartments['Marketing/Digital Marketing'].id,
      assignedToId: exec1.id,
      createdById: marketingManager.id,
      startDate: new Date(),
      dueDate: new Date(),
      priority: 'MEDIUM' as const,
      status: 'NOT_STARTED' as const,
      completionPercent: 0,
    },
    {
      taskId: 'T-DAILY-002',
      title: 'Reconcile daily vendor payments',
      workType: 'DAILY' as const,
      departmentId: departments.Finance.id,
      subDepartmentId: subDepartments['Finance/Accounts'].id,
      assignedToId: exec2.id,
      createdById: financeManager.id,
      startDate: new Date(),
      dueDate: new Date(Date.now() + 86400000),
      priority: 'LOW' as const,
      status: 'NOT_STARTED' as const,
      completionPercent: 0,
    },
  ];

  for (const t of taskDefs) {
    await prisma.task.upsert({ where: { taskId: t.taskId }, create: t, update: {} });
  }

  console.log('\nSeed complete. Login credentials:');
  console.log('  Admin/GMA:        username=admin           password=Admin@123');
  console.log('  Marketing Manager: username=mktg.manager    password=Manager@123');
  console.log('  Finance Manager:   username=fin.manager     password=Manager@123');
  console.log('  Marketing Exec:    username=exec.arun       password=Exec@123');
  console.log('  Finance Exec:      username=exec.divya      password=Exec@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
