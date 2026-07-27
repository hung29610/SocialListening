'use client';

import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function OrganizationPage() {
  const { currentOrganization, organizations, isLoading } = useAuth();

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-paper mb-6">Organization Settings</h1>

      {currentOrganization ? (
        <div className="bg-void-surface border border-edge rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 text-paper">Current Organization</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-paper-faint">Name</p>
              <p className="font-medium text-paper">{currentOrganization.name}</p>
            </div>
            <div>
              <p className="text-sm text-paper-faint">Role</p>
              <p className="font-medium text-paper capitalize">{currentOrganization.role}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-warning/10 text-warning border border-warning/25 p-4 rounded-md mb-8">
          You are not currently active in any organization.
        </div>
      )}

      <div className="bg-void-surface border border-edge rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 text-paper">Your Organizations</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-edge">
            <thead>
              <tr className="border-b border-edge">
                <th scope="col" className="px-6 py-3 text-left text-eyebrow font-semibold uppercase text-paper-faint">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-eyebrow font-semibold uppercase text-paper-faint">Role</th>
                <th scope="col" className="px-6 py-3 text-left text-eyebrow font-semibold uppercase text-paper-faint">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {organizations.map(org => (
                <tr key={org.id} className="border-b border-edge hover:bg-void-raised transition-colors duration-150 motion-reduce:transition-none">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-paper">
                    {org.name}
                    {currentOrganization?.id === org.id && (
                      <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/25">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-paper-muted capitalize">
                    {org.role}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-paper-muted">
                    <button
                      disabled={currentOrganization?.id === org.id}
                      className="text-signal dark:text-signal-bright hover:text-signal-deep dark:hover:text-signal disabled:opacity-50 disabled:cursor-not-allowed rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal/70"
                    >
                      Switch
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
