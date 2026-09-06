import React, { useState } from 'react';
import {
  ShieldCheck,
  Users,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Layers,
} from 'lucide-react';
import { IntegrationConnection, Role, Department } from '../types';
import { INTEGRATION_TOOLS } from '../lib/integrationService';

interface IntegrationAccessConfigModalProps {
  connections: IntegrationConnection[];
  roles: Role[];
  departments: Department[];
  onSave: (updatedConnections: IntegrationConnection[]) => void;
  onContinue?: () => void;
  isInline?: boolean;
}

export const IntegrationAccessConfigModal: React.FC<IntegrationAccessConfigModalProps> = ({
  connections,
  roles,
  departments,
  onSave,
  onContinue,
  isInline = false,
}) => {
  // Local state mapping connection id to 'all' or array of role IDs
  const [accessMap, setAccessMap] = useState<Record<string, 'all' | string[]>>(() => {
    const map: Record<string, 'all' | string[]> = {};
    connections.forEach((conn) => {
      map[conn.id] = conn.accessRoleIds || 'all';
    });
    return map;
  });

  const handleToggleRole = (connId: string, roleId: string) => {
    const current = accessMap[connId];
    const currentList = Array.isArray(current) ? current : [];
    const nextList = currentList.includes(roleId)
      ? currentList.filter((id) => id !== roleId)
      : [...currentList, roleId];

    setAccessMap({
      ...accessMap,
      [connId]: nextList.length === 0 ? [] : nextList,
    });
  };

  const handleSelectAll = (connId: string) => {
    setAccessMap({
      ...accessMap,
      [connId]: 'all',
    });
  };

  const handleSelectSpecific = (connId: string) => {
    const current = accessMap[connId];
    if (current === 'all') {
      // Default to selecting all existing roles initially when switching to specific
      setAccessMap({
        ...accessMap,
        [connId]: roles.map((r) => r.id),
      });
    }
  };

  const handleSaveAndProceed = () => {
    const updated = connections.map((conn) => ({
      ...conn,
      accessRoleIds: accessMap[conn.id] || 'all',
    }));
    onSave(updated);
    if (onContinue) {
      onContinue();
    }
  };

  return (
    <div
      id="integration-access-config-container"
      className={
        isInline
          ? 'space-y-6'
          : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4'
      }
    >
      <div
        className={
          isInline
            ? 'w-full'
            : 'w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 max-h-[85vh] overflow-y-auto'
        }
      >
        <div className="mb-5">
          <h3 className="text-lg font-bold text-slate-900 font-serif-heading">
            Who gets to use these?
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Specify which roles across the organization have access to each connected tool.
            You can always modify these permissions later from Settings.
          </p>
        </div>

        <div className="space-y-4">
          {connections.map((conn) => {
            const toolDef = INTEGRATION_TOOLS.find((t) => t.key === conn.integrationKey);
            const toolName = toolDef?.name || conn.integrationKey;
            const currentSetting = accessMap[conn.id] || 'all';
            const isAll = currentSetting === 'all';
            const selectedRoleIds = Array.isArray(currentSetting) ? currentSetting : [];

            return (
              <div
                key={conn.id}
                id={`access-card-${conn.integrationKey}`}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">{toolName}</span>
                    <span className="text-[11px] text-slate-500 font-mono-code bg-white px-2 py-0.5 rounded border border-slate-200">
                      {conn.accountLabel}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-slate-400">
                    {conn.scope === 'org' ? 'Org-wide Connection' : 'Root Scope'}
                  </span>
                </div>

                {/* Radio Options */}
                <div className="space-y-2 pt-1 text-xs">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`access-scope-${conn.id}`}
                      checked={isAll}
                      onChange={() => handleSelectAll(conn.id)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-800">
                      All roles in the organization
                    </span>
                  </label>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`access-scope-${conn.id}`}
                      checked={!isAll}
                      onChange={() => handleSelectSpecific(conn.id)}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-800">
                      Specific roles only
                    </span>
                  </label>

                  {/* Specific Roles Checklist */}
                  {!isAll && (
                    <div className="ml-6 mt-3 p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Choose eligible roles ({selectedRoleIds.length}/{roles.length} selected):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                        {roles.map((role) => {
                          const dept = departments.find((d) => d.id === role.deptId);
                          const checked = selectedRoleIds.includes(role.id);
                          return (
                            <label
                              key={role.id}
                              className="flex items-start gap-2 text-xs p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleRole(conn.id, role.id)}
                                className="mt-0.5 text-indigo-600 focus:ring-indigo-500 rounded"
                              />
                              <div className="min-w-0">
                                <div className="font-medium text-slate-800 truncate">
                                  {role.title}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {dept?.name || 'Department'}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            id="save-integration-access-btn"
            onClick={handleSaveAndProceed}
            className="px-5 py-2.5 bg-[#2F3B7A] hover:bg-indigo-900 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-xs transition-colors"
          >
            <span>Confirm & Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
