import React, { useState } from 'react';
import {
  Check,
  Lock,
  ExternalLink,
  Trash2,
  HardDrive,
  Github,
  Figma,
  Palette,
  Calendar,
  Video,
  Mail,
  CheckSquare,
  FileQuestion,
  GraduationCap,
  Bookmark,
  AlertCircle,
} from 'lucide-react';
import {
  INTEGRATION_TOOLS,
  IntegrationToolDefinition,
} from '../lib/integrationService';
import { IntegrationConnection } from '../types';
import { OAuthConnectModal } from './OAuthConnectModal';

interface IntegrationChecklistProps {
  connections: IntegrationConnection[];
  scope: 'org' | 'root';
  isEnterpriseOrg?: boolean;
  onConnect: (toolKey: string, accountLabel: string) => Promise<void> | void;
  onDisconnect?: (connId: string) => Promise<void> | void;
  // If in root mode, pass the list of org-wide connections to detect already-covered tools
  orgWideConnections?: IntegrationConnection[];
}

export const IntegrationChecklist: React.FC<IntegrationChecklistProps> = ({
  connections,
  scope,
  isEnterpriseOrg = false,
  onConnect,
  onDisconnect,
  orgWideConnections = [],
}) => {
  const [activeOAuthTool, setActiveOAuthTool] = useState<IntegrationToolDefinition | null>(null);

  // Helper to map tool key to an icon
  const renderIcon = (key: string) => {
    switch (key) {
      case 'google_drive':
        return <HardDrive className="w-4 h-4 text-emerald-600" />;
      case 'github':
        return <Github className="w-4 h-4 text-slate-800" />;
      case 'figma':
        return <Figma className="w-4 h-4 text-purple-600" />;
      case 'canva':
        return <Palette className="w-4 h-4 text-cyan-600" />;
      case 'google_calendar':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'google_meet':
        return <Video className="w-4 h-4 text-green-600" />;
      case 'google_gmail':
        return <Mail className="w-4 h-4 text-red-500" />;
      case 'google_tasks':
        return <CheckSquare className="w-4 h-4 text-indigo-600" />;
      case 'google_forms':
        return <FileQuestion className="w-4 h-4 text-purple-500" />;
      case 'google_classroom':
        return <GraduationCap className="w-4 h-4 text-emerald-700" />;
      case 'google_keep':
        return <Bookmark className="w-4 h-4 text-amber-500" />;
      default:
        return <ExternalLink className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div id="integration-checklist-root" className="space-y-2">
      {INTEGRATION_TOOLS.map((tool) => {
        // Filter enterprise only if not enabled
        if (tool.enterpriseOnly && !isEnterpriseOrg) {
          return null;
        }

        // 1. Google Drive is always included and locked
        if (tool.isAlwaysIncluded) {
          return (
            <div
              key={tool.key}
              id={`tool-item-${tool.key}`}
              className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-200/70 select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  {renderIcon(tool.key)}
                  <span className="text-xs font-semibold text-slate-900">{tool.name}</span>
                  <span className="text-[11px] text-emerald-700 font-medium">
                    (always included)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono-code">
                <Lock className="w-3 h-3 text-slate-400" />
                <span>Default Core Vault</span>
              </div>
            </div>
          );
        }

        // 2. Check if already covered org-wide (for root scope)
        const coveredOrgWide =
          scope === 'root' &&
          orgWideConnections.find((c) => c.integrationKey === tool.key && c.scope === 'org');

        if (coveredOrgWide) {
          return (
            <div
              key={tool.key}
              id={`tool-item-${tool.key}`}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 opacity-90 select-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md bg-slate-300 text-slate-700 flex items-center justify-center">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div className="flex items-center gap-2">
                  {renderIcon(tool.key)}
                  <span className="text-xs font-semibold text-slate-800">{tool.name}</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-500 font-medium italic">
                Your roles already have {tool.name} access, connected org-wide
              </span>
            </div>
          );
        }

        // 3. Check if currently connected in this scope
        const currentConn = connections.find(
          (c) => c.integrationKey === tool.key && c.scope === scope
        );
        const isConnected = Boolean(currentConn);

        return (
          <div
            key={tool.key}
            id={`tool-item-${tool.key}`}
            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
              isConnected
                ? 'bg-indigo-50/40 border-indigo-200'
                : 'bg-white border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              {/* Checkbox trigger: clicking immediately opens OAuth popup! */}
              <button
                type="button"
                id={`tool-checkbox-${tool.key}`}
                onClick={() => {
                  if (isConnected) {
                    if (onDisconnect && currentConn) {
                      if (window.confirm(`Disconnect ${tool.name}?`)) {
                        onDisconnect(currentConn.id);
                      }
                    }
                  } else {
                    setActiveOAuthTool(tool);
                  }
                }}
                className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors cursor-pointer ${
                  isConnected
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-slate-300 bg-white hover:border-indigo-400'
                }`}
              >
                {isConnected && <Check className="w-3.5 h-3.5" />}
              </button>

              <div
                onClick={() => {
                  if (!isConnected) {
                    setActiveOAuthTool(tool);
                  }
                }}
                className="flex items-center gap-2 cursor-pointer select-none"
              >
                {renderIcon(tool.key)}
                <span className="text-xs font-semibold text-slate-800">{tool.name}</span>
                {tool.enterpriseOnly && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    Enterprise
                  </span>
                )}
              </div>
            </div>

            {/* Account info or status */}
            <div className="flex items-center gap-3">
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono-code text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md border border-indigo-200/60">
                    {currentConn?.accountLabel}
                  </span>
                  {onDisconnect && currentConn && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Disconnect ${tool.name}?`)) {
                          onDisconnect(currentConn.id);
                        }
                      }}
                      title="Disconnect integration"
                      className="p-1 text-slate-400 hover:text-red-600 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveOAuthTool(tool)}
                  className="text-[11px] text-slate-400 hover:text-indigo-600 font-medium transition-colors"
                >
                  Click to connect
                </button>
              )}
            </div>
          </div>
        );
      })}

      {/* Triggered OAuth modal */}
      {activeOAuthTool && (
        <OAuthConnectModal
          tool={activeOAuthTool}
          scope={scope}
          onSuccess={async (accountLabel) => {
            const toolKey = activeOAuthTool.key;
            setActiveOAuthTool(null);
            await onConnect(toolKey, accountLabel);
          }}
          onClose={() => setActiveOAuthTool(null)}
        />
      )}
    </div>
  );
};
