export async function afterIdentityRefresh<T>(refreshIdentity: () => Promise<void>, continueFlow: () => Promise<T>): Promise<T> {
  await refreshIdentity()
  return continueFlow()
}
