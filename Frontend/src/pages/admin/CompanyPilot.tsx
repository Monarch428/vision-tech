import { useState } from 'react';
import { migrateLegacyCompanies } from '../../services/company.service';

export default function CompanyPilot() {
  const [result, setResult] = useState<any>(null); const [error, setError] = useState('');
  const migrate = async (apply: boolean) => { try { setError(''); setResult((await migrateLegacyCompanies(apply)).data); } catch (e: any) { setError(e?.response?.data?.message || 'Migration request failed'); } };
  return <main className="p-5 sm:p-8 space-y-5"><div><h1 className="text-2xl font-bold">Company pilot administration</h1><p className="text-gray-600">Review legacy users before creating company ownership records. Provider allocations remain manual and verified.</p></div><div className="rounded-xl border bg-white p-5 space-x-3"><button className="rounded bg-slate-700 px-4 py-2 text-white" onClick={() => migrate(false)}>Preview migration</button><button className="rounded bg-amber-700 px-4 py-2 text-white" onClick={() => migrate(true)}>Apply migration</button></div>{error && <p className="text-red-700">{error}</p>}{result && <pre className="overflow-auto rounded bg-slate-950 p-4 text-sm text-slate-100">{JSON.stringify(result, null, 2)}</pre>}</main>;
}
