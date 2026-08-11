'use client';

import { AnalysisResult } from '@/lib/types';

interface Props {
  results: AnalysisResult[];
}

export default function ResultsTable({ results }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full">
        <thead className="border-b bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Business</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Score</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Opportunity</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-900">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {results.map((result, index) => (
            <tr key={index} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-sm text-slate-900 font-medium">
                {result.business.name}
              </td>
              <td className="px-4 py-3 text-sm text-slate-900 font-bold">
                {result.analysis?.overall || 'Error'}
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${
                    result.analysis?.opportunity === 'high'
                      ? 'bg-red-100 text-red-700'
                      : result.analysis?.opportunity === 'medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-green-100 text-green-700'
                  }`}
                >
                  {result.analysis?.opportunity || 'N/A'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">
                {result.error ? '❌ Error' : '✅ Analyzed'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
