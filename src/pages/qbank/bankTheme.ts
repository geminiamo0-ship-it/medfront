/** Per-provider gradients, mirroring the backend main-bank seeds. */
export const PROVIDER_GRADIENTS: Array<[prefix: string, gradient: string]> = [
  ['UWORLD', 'linear-gradient(135deg, #1e3c72 0%, #2a69ac 100%)'],
  ['AMBOSS', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'],
  ['MEHLMAN', 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)'],
  ['NBME', 'linear-gradient(135deg, #c0392b 0%, #e74c3c 100%)'],
  ['CMS', 'linear-gradient(135deg, #f39c12 0%, #f1c40f 100%)'],
  ['PASS_MED', 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)'],
  ['PASTEST', 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'],
  ['PAST_PAPERS', 'linear-gradient(135deg, #475569 0%, #334155 100%)'],
  ['ONEXAM', 'linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)'],
  ['MRCP_PART', 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)'],
  ['MEDPARK', 'linear-gradient(135deg, #ff4500 0%, #ff7849 100%)'],
];

export function providerGradient(code: string): string {
  const normalized = code.trim().toUpperCase();
  for (const [prefix, gradient] of PROVIDER_GRADIENTS) {
    if (normalized.startsWith(prefix)) return gradient;
  }
  return 'linear-gradient(135deg, #ff4500 0%, #ff7849 100%)';
}

export function providerInitials(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();
}
