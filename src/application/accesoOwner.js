// company.manage representa la administración de la organización. Los permisos
// operativos deben proceder de otro rol asignado, nunca del rol del owner.
export function esOwnerSinOperacion(contexto) {
  return (
    !!contexto?.permite('company.manage') &&
    ![
      'harvest.view',
      'harvest.manage',
      'harvest.operate',
      'workforce.manage',
      'campaign.manage',
      'farm.manage'
    ].some((permiso) => contexto.permite(permiso))
  )
}
