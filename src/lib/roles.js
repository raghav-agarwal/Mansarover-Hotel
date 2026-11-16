export const ROLES = {
  management: 'Management',
  manager: 'Manager',
  accountant: 'Accountant',
}

// Who can open which area of the app.
export const ACCESS = {
  summary: ['accountant', 'management'],
  users: ['management'],
  tasks: ['management', 'manager', 'accountant'],
  maintenance: ['management', 'manager', 'accountant'],
  maintenanceSetup: ['management'],
  generator: ['management', 'accountant'],
  generatorSetup: ['management'],
  maintenanceFill: ['management', 'manager'],
}

export const can = (user, area) => !!user && ACCESS[area].includes(user.role)
