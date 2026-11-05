import React, { useState, useEffect, useMemo } from 'react';
import { TaskMention, FileItem, OrgIntegrations } from '../types';
import { getStoredOrgId } from '../lib/api';
import { githubRepos, githubTree, type GithubRepo } from '../lib/integrationsApi';
import { 
  Github, 
  Figma, 
  Layers, 
  FileText, 
  HardDrive, 
  ExternalLink,
  Code,
  Search
} from 'lucide-react';

interface MentionDropdownProps {
  query: string; // text following the '@'
  vaultFiles?: FileItem[];
  integrations?: OrgIntegrations;
  onSelect: (mention: TaskMention) => void;
  onClose: () => void;
}

export const MentionDropdown: React.FC<MentionDropdownProps> = ({
  query,
  vaultFiles = [],
  integrations,
  onSelect,
  onClose
}) => {
  const orgId = getStoredOrgId();
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [remoteGithubFiles, setRemoteGithubFiles] = useState<{ path: string; repo: string; url: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // If query starts with a repo name followed by '/', e.g. "mika-core/src/"
  const isRepoFileDrilldown = query.includes('/');
  const [drillRepo, ...rest] = query.split('/');
  const dirPath = rest.slice(0, -1).join('/');            // folder being browsed
  const fileDrillQuery = (rest[rest.length - 1] || '').toLowerCase(); // what has been typed of the file name

  // Real repositories from the GitHub App installation (empty when GitHub is not connected)
  useEffect(() => {
    if (!orgId) return;
    githubRepos(orgId).then(r => setRepos(r.repos)).catch(() => setRepos([]));
  }, [orgId]);

  // Browse one folder of the repo being typed
  const drillFullName = repos.find(r => r.name.toLowerCase() === drillRepo.toLowerCase())?.fullName;
  useEffect(() => {
    if (!isRepoFileDrilldown || !orgId || !drillFullName) { setRemoteGithubFiles([]); return; }
    let cancelled = false;
    setIsLoading(true);
    githubTree(orgId, drillFullName, dirPath)
      .then(d => { if (!cancelled) setRemoteGithubFiles(d.items.filter(i => i.type === 'file').map(i => ({ path: i.path, repo: drillRepo, url: i.url }))); })
      .catch(() => { if (!cancelled) setRemoteGithubFiles([]); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [isRepoFileDrilldown, orgId, drillFullName, dirPath, drillRepo]);

  // Compute matched items
  const suggestions = useMemo(() => {
    const list: TaskMention[] = [];
    const q = query.toLowerCase();

    // 1. If drilldown into repo files (@repo/path)
    if (isRepoFileDrilldown && drillRepo) {
      remoteGithubFiles
        .filter(f => !fileDrillQuery || f.path.split('/').pop()!.toLowerCase().includes(fileDrillQuery))
        .slice(0, 8)
        .forEach(f => {
          list.push({
            type: 'github_file',
            externalId: `${f.repo}/${f.path}`,
            displayName: `@${f.repo}/${f.path}`,
            url: f.url,
            repo: f.repo,
            path: f.path
          });
        });
      return list;
    }

    // 2. Connected GitHub Repositories
    repos
      .filter(r => !q || r.name.toLowerCase().includes(q))
      .slice(0, 8)
      .forEach(r => {
        list.push({
          type: 'github_repo',
          externalId: r.id,
          displayName: `@${r.name}`,
          url: r.url,
          repo: r.name
        });
      });

    // 3. Vault Files (Figma, Canva, Google Docs/Drive)
    vaultFiles
      .filter(f => !q || f.name.toLowerCase().includes(q) || (f.integrationSource || '').toLowerCase().includes(q))
      .slice(0, 6)
      .forEach(f => {
        let mentionType: TaskMention['type'] = 'drive_file';
        if (f.integrationSource === 'figma') mentionType = 'figma_file';
        else if (f.integrationSource === 'canva') mentionType = 'canva_design';
        else if (f.integrationSource === 'google_docs') mentionType = 'google_doc';

        list.push({
          type: mentionType,
          externalId: f.id,
          displayName: `@${f.name}`,
          url: f.url || '#',
        });
      });

    return list;
  }, [query, isRepoFileDrilldown, drillRepo, fileDrillQuery, remoteGithubFiles, vaultFiles, repos]);

  const getIcon = (type: TaskMention['type']) => {
    switch (type) {
      case 'github_repo':
      case 'github_file':
        return <Github className="w-4 h-4 text-slate-700" />;
      case 'figma_file':
        return <Figma className="w-4 h-4 text-purple-600" />;
      case 'canva_design':
        return <Layers className="w-4 h-4 text-cyan-600" />;
      case 'google_doc':
      case 'google_sheet':
      case 'google_slide':
        return <FileText className="w-4 h-4 text-blue-600" />;
      default:
        return <HardDrive className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div 
      id="mention-dropdown-root" 
      className="absolute left-0 top-full mt-1 w-80 bg-surface rounded-xl shadow-xl border border-slate-200 py-2 z-50 overflow-hidden"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 flex items-center justify-between border-b border-slate-100">
        <span>{isRepoFileDrilldown ? `Files in @${drillRepo}` : 'Reference an Asset or Repo'}</span>
        {isLoading && <span className="animate-pulse text-indigo-600">Loading...</span>}
      </div>

      <div className="max-h-60 overflow-y-auto py-1">
        {suggestions.length === 0 ? (
          <div className="px-4 py-3 text-xs text-slate-400 text-center">
            No matching repo, file, or design found. GitHub repos appear here once GitHub is connected.
          </div>
        ) : (
          suggestions.map((item, idx) => (
            <button
              key={`${item.externalId}-${idx}`}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full px-3.5 py-2 text-left hover:bg-indigo-50 flex items-center gap-2.5 transition text-xs group"
            >
              <div className="shrink-0 p-1 rounded bg-slate-100 group-hover:bg-surface transition">
                {getIcon(item.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 truncate">
                  {item.displayName}
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {item.type.replace('_', ' ')}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {!isRepoFileDrilldown && (
        <div className="px-3 py-1.5 bg-slate-50 text-[11px] text-slate-500 border-t border-slate-100">
          Tip: Type <code className="text-slate-800 bg-surface px-1 py-0.5 rounded border border-slate-200">@repo-name/</code> to drill down into repo files!
        </div>
      )}
    </div>
  );
};
