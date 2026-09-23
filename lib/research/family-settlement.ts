// Research-only proof algebra. Nothing here grants execution admission.
export const settlementClasses = ['LIVE_EXACT', 'STATE_CONDITIONED', 'BOUNDED_BASIS', 'INCOMPATIBLE', 'UNRESOLVED'] as const;
export type SettlementClass = typeof settlementClasses[number];
export const routeDimensions = ['entity', 'threshold', 'orientation', 'window', 'geography', 'source', 'familyDimensions'] as const;
export type RouteDimension = typeof routeDimensions[number];
export type DimensionProof = { kalshi: string; poly: string; evidence: string };
export type StateProof = {
  predicate: string;
  evidence: string;
  // The rule proof must eliminate this branch, not merely make it less likely.
  eliminates: string[];
  bothTradableAfter: 'PROVEN' | 'CLOSED' | 'UNKNOWN';
};
export type FamilyProof = {
  id: string;
  documents: string[];
  missingEvidence: string[];
  ordinaryConflicts: string[];
  divergences: { id: string; evidence: string }[];
  stateProofs: StateProof[];
};
export type RouteProof = {
  dimensions: Partial<Record<RouteDimension, DimensionProof>>;
  missingEvidence: string[];
  conflicts: string[];
};
export function classifySettlement(family: FamilyProof, route: RouteProof): {
  classification: SettlementClass; reasons: string[]; state?: StateProof; executable: false;
} {
  const result = (classification: SettlementClass, reasons: string[], state?: StateProof) => ({classification, reasons, ...(state ? {state} : {}), executable: false as const});
  const conflicts = [...family.ordinaryConflicts, ...route.conflicts];
  for (const name of routeDimensions) {
    const d = route.dimensions[name];
    if (d && d.kalshi !== d.poly) conflicts.push(`Different ${name}: ${d.kalshi} / ${d.poly}`);
  }
  // A known ordinary conflict is decisive even if other evidence is missing.
  if (conflicts.length) return result('INCOMPATIBLE', conflicts);
  const missing = [...family.missingEvidence, ...route.missingEvidence];
  if (!family.documents.length || family.documents.some(d => !d.trim())) missing.push('Controlling documents unbound');
  for (const name of routeDimensions) {
    const d = route.dimensions[name];
    if (!d?.kalshi.trim() || !d.poly.trim() || !d.evidence.trim()) missing.push(`Missing ${name} proof`);
  }
  if (family.divergences.some(d => !d.id.trim() || !d.evidence.trim())) missing.push('Unsubstantiated branch comparison');
  if (missing.length) return result('UNRESOLVED', [...new Set(missing)]);
  if (!family.divergences.length) return result('LIVE_EXACT', ['All reviewed material branches complementary']);
  const state = family.stateProofs.find(s => s.predicate.trim() && s.evidence.trim() && family.divergences.every(d => s.eliminates.includes(d.id)));
  if (state) return result('STATE_CONDITIONED', ['Conditional rule proof covers every divergence; trading availability is a separate result'], state);
  return result('BOUNDED_BASIS', family.divergences.map(d => d.id));
}

export type LateState = {
  kind: 'STARTED' | 'FINAL_RESULT' | 'PUBLICATION' | 'DEADLINE_PASSED';
  officialEvidence: string;
  observedAt: number;
  eventAt: number;
  exceptionsIndicated: boolean;
  sourceFinal: boolean;
};
// Useful for a future bounded-basis shortlist, never an equivalence certificate.
export function lateStateUsable(state: LateState, now: number, markets: {open: boolean; checkedAt: number; closesAt: number}[]) {
  return !!state.officialEvidence.trim() && Number.isFinite(now) && state.observedAt <= now && now - state.observedAt <= 2000 &&
    Number.isFinite(state.eventAt) && state.eventAt <= state.observedAt && !state.exceptionsIndicated &&
    (state.kind === 'STARTED' || state.sourceFinal) && markets.length === 2 && markets.every(m =>
      m.open && Number.isFinite(m.closesAt) && m.checkedAt <= now && now - m.checkedAt <= 2000 && m.closesAt > now);
}
