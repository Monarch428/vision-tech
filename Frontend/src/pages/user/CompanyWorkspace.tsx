import { useEffect, useState } from 'react';
import { getCompany, getCompanyDevices, getCompanyEndpoints, startCompanyScan } from '../../services/company.service';
import type { Company, CompanyDevice, AntivirusEndpoint } from '../../services/company.service';

export default function CompanyWorkspace() {
  const [company, setCompany] = useState<Company | null>(null);
  const [devices, setDevices] = useState<CompanyDevice[]>([]);
  const [endpoints, setEndpoints] = useState<AntivirusEndpoint[]>([]);
  const [message, setMessage] = useState('Loading company workspace…');
  useEffect(() => { (async () => {
    try {
      const current = await getCompany(); setCompany(current);
      if (!current.paid) return setMessage('A paid subscription is required to access managed providers.');
      const [deviceRows, endpointRows] = await Promise.all([getCompanyDevices(), getCompanyEndpoints()]);
      setDevices(deviceRows); setEndpoints(endpointRows); setMessage('');
    } catch (error: any) { setMessage(error?.response?.data?.message || 'Company pilot is unavailable.'); }
  })(); }, []);
  const scan = async (id: string) => { try { await startCompanyScan(id); setMessage('Antivirus scan queued.'); } catch (error: any) { setMessage(error?.response?.data?.message || 'Could not queue scan.'); } };
  return <main className="p-5 sm:p-8 space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">Company workspace</h1><p className="text-gray-600">Tenant-scoped Tactical RMM and Bitdefender access.</p></div>
    {company && <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">{company.name}</h2><p className="text-sm text-gray-600">Role: {company.role} · {company.paid ? 'Paid entitlement active' : 'No paid entitlement'}</p><p className="mt-2 text-sm">Allocated providers: {company.providers.map(p => p.provider).join(', ') || 'None'}</p></section>}
    {message && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{message}</p>}
    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold mb-3">Managed devices</h2><div className="space-y-2">{devices.length ? devices.map(d => <div className="flex justify-between border-b py-2 text-sm" key={d.agent_id}><span>{d.hostname || d.agent_id}</span><span>{d.operating_system || 'Unknown OS'} · {d.status || 'Unknown'}</span></div>) : <p className="text-sm text-gray-500">No company-scoped devices available.</p>}</div></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold mb-3">Antivirus endpoints</h2><div className="space-y-2">{endpoints.length ? endpoints.map(e => <div className="flex justify-between border-b py-2 text-sm" key={e.id}><span>{e.name || e.id} · {e.status || 'Unknown'}</span><button className="rounded bg-green-700 px-3 py-1 text-white" onClick={() => scan(e.id)}>Run scan</button></div>) : <p className="text-sm text-gray-500">No Bitdefender endpoints available.</p>}</div></section>
  </main>;
}
