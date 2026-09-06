import React, { useState, useEffect, useMemo } from 'react';
import { TaskMention, FileItem, OrgIntegrations } from '../types';
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
  const [remoteGithubFiles, setRemoteGithubFiles] = useState<{ path: string; repo: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // If query starts with a repo name followed by '/', e.g. "mika-core/src"
  const isRepoFileDrilldown = query.includes('/');
  const [drillRepo, ...rest] = query.split('/');
  const fileDrillQuery = rest.join('/').toLowerCase();

  // Fetch GitHub tree if drilling into repo
  useEffect(() => {
    if (isRepoFileDrilldown && drillRepo) {
      setIsLoading(true);
      fetch(`/api/integrations/github/tree?repo=${encodeURIComponent(drillRepo)}`)
        .then(res => res.json())
        .then(data => {
          if (data.files) {
            setRemoteGithubFiles(data.files.map((f: any) => ({ path: f.path, repo: drillRepo })));
          }
        })
        .catch(err => console.warn('GitHub tree error:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isRepoFileDrilldown, drillRepo]);

  // Compute matched items
  const suggestions = useMemo(() => {
    const list: TaskMention[] = [];
    const q = query.toLowerCase();

    // 1. If drilldown into repo files (@repo/path)
    if (isRepoFileDrilldown && drillRepo) {
      remoteGithubFiles
        .filter(f => !fileDrillQuery || f.path.toLowerCase().includes(fileDrillQuery))
        .slice(0, 8)
        .forEach(f => {
          list.push({
            type: 'github_file',
            externalId: `${f.repo}/${f.path}`,
            displayName: `@${f.repo}/${f.path}`,
            url: `https://github.com/codeNinjaJane/${f.repo}/blob/main/${f.path}`,
            repo: f.repo,
            path: f.path
          });
        });
      return list;
    }

    // 2. Connected GitHub Repositories
    const repos = [
      { id: 'mika-core', name: 'mika-core', url: 'https://github.com/codeNinjaJane/mika-core' },
      { id: 'mika-prototypes', name: 'mika-prototypes', url: 'https://github.com/codeNinjaJane/mika-prototypes' },
      { id: 'school-portal', name: 'school-portal', url: 'https://github.com/school-edu/portal' },
      { id: 'org-docs', name: 'org-docs', url: 'https://github.com/org/docs' }
    ];

    repos
      .filter(r => !q || r.name.toLowerCase().includes(q))
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
  }, [query, isRepoFileDrilldown, drillRepo, fileDrillQuery, remoteGithubFiles, vaultFiles]);

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
      className="absolute left-0 top-full mt-1 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 overflow-hidden"
    >
      <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between border-b border-slate-100">
        <span>{isRepoFileDrilldown ? `Files in @${drillRepo}` : 'Reference an Asset or Repo'}</span>
        {isLoading && <span className="animate-pulse text-indigo-600">Loading...</span>}
      </div>

      <div className="max-h-60 overflow-y-auto py-1">
        {suggestions.length === 0 ? (
          <div className="px-4 py-3 text-xs text-slate-400 text-center">
            No matching repo, file, or design found.
          </div>
        ) : (
          suggestions.map((item, idx) => (
            <button
              key={`${item.externalId}-${idx}`}
              type="button"
              onClick={() => onSelect(item)}
              className="w-full px-3.5 py-2 text-left hover:bg-indigo-50 flex items-center gap-2.5 transition text-xs group"
            >
              <div className="shrink-0 p-1 rounded bg-slate-100 group-hover:bg-white transition">
                {getIcon(item.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-slate-900 truncate">
                  {item.displayName}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {item.type.replace('_', ' ')}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {!isRepoFileDrilldown && (
        <div className="px-3 py-1.5 bg-slate-50 text-[10px] text-slate-500 border-t border-slate-100">
          Tip: Type <code className="text-slate-800 bg-white px-1 py-0.5 rounded border border-slate-200">@repo-name/</code> to drill down into repo files!
        </div>
      )}
    </div>
  );
};
