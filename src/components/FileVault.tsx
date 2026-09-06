import React, { useState, useMemo, useEffect, useRef } from 'react';
import { FileItem, Department, User, Task } from '../types';
import { 
  FileText, 
  Upload, 
  Download, 
  Search, 
  ExternalLink, 
  Copy, 
  Trash2, 
  MoreVertical, 
  Check, 
  Figma, 
  Layers, 
  Github, 
  FileSpreadsheet, 
  FileCheck, 
  FolderLock, 
  Globe, 
  Plus, 
  Image as ImageIcon,
  FolderSync
} from 'lucide-react';
import { upsertFileItem, removeFileItem, subscribeFiles } from '../lib/firestoreService';
import confetti from 'canvas-confetti';

interface FileVaultProps {
  currentUser?: User | null;
  files?: FileItem[];
  departments?: Department[];
  allDepts?: Department[];
  tasks?: Task[];
  orgId?: string;
  onUploadFile?: (deptId: string, file: File, destination?: 'department' | 'myself') => void;
}

export const FileVault: React.FC<FileVaultProps> = ({
  currentUser,
  files = [],
  departments = [],
  allDepts = [],
  tasks = [],
  orgId = 'org_school',
  onUploadFile
}) => {
  const depts = allDepts.length > 0 ? allDepts : departments;
  const currentUserId = currentUser?.id || 'u_principal';

  // Active view: either a deptId or 'myself'
  const [selectedView, setSelectedView] = useState<string>(depts[0]?.id || 'myself');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMenuFileId, setActiveMenuFileId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Local state for items
  const [vaultFiles, setVaultFiles] = useState<FileItem[]>(() => {
    if (files.length > 0) return files;
    // Initial seeded items covering Google, Figma, Canva, and Code
    return [
      {
        id: 'file_curriculum_2026',
        orgId: 'org_school',
        deptId: 'dept_kindergarde',
        name: 'Early Learning Curriculum Plan 2026.gdoc',
        size: '1.2 MB',
        type: 'application/vnd.google-apps.document',
        url: 'https://docs.google.com/document/d/sample-curriculum/edit',
        uploadedByUserId: 'u_principal',
        uploadedByName: 'Principal Anderson',
        uploadedAt: '2026-09-02T10:00:00Z',
        archiveDestination: 'department',
        entryType: 'preview_link',
        integrationSource: 'google_docs',
        thumbnailUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&q=80'
      },
      {
        id: 'file_brand_figma',
        orgId: 'org_school',
        deptId: 'dept_kindergarde',
        name: 'School Visual Design System v2.fig',
        size: '14.5 MB',
        type: 'application/x-figma',
        url: 'https://www.figma.com/file/fig_brand_v1?node-id=0-1',
        uploadedByUserId: 'u_principal',
        uploadedByName: 'Principal Anderson',
        uploadedAt: '2026-09-03T11:30:00Z',
        archiveDestination: 'department',
        entryType: 'preview_link',
        integrationSource: 'figma',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80'
      },
      {
        id: 'file_canva_stem',
        orgId: 'org_school',
        deptId: 'dept_kindergarde',
        name: 'Annual STEM Week Flyer.canva',
        size: '3.8 MB',
        type: 'application/x-canva',
        url: 'https://www.canva.com/design/canva_flyer_stem',
        uploadedByUserId: 'u_principal',
        uploadedByName: 'Principal Anderson',
        uploadedAt: '2026-09-04T09:15:00Z',
        archiveDestination: 'department',
        entryType: 'preview_link',
        integrationSource: 'canva',
        thumbnailUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=300&q=80'
      },
      {
        id: 'file_priv_notes',
        orgId: 'org_school',
        deptId: 'dept_school',
        name: 'Executive Personnel Notes & Strategy.pdf',
        size: '420 KB',
        type: 'application/pdf',
        url: 'https://drive.google.com/file/d/sample-priv-notes/view',
        uploadedByUserId: 'u_principal',
        uploadedByName: 'Principal Anderson',
        uploadedAt: '2026-09-05T08:00:00Z',
        archiveDestination: 'myself',
        archivedByUserId: 'u_principal',
        entryType: 'preview_link',
        integrationSource: 'google_drive'
      }
    ];
  });

  // Modal for Adding link or uploading
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalType, setModalType] = useState<'link' | 'upload'>('link');
  const [itemName, setItemName] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [itemSource, setItemSource] = useState<'google_docs' | 'figma' | 'canva' | 'github' | 'upload'>('figma');
  const [itemDestination, setItemDestination] = useState<'department' | 'myself'>('department');
  const [itemEntryType, setItemEntryType] = useState<'preview_link' | 'full_import'>('preview_link');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to Firestore files
  useEffect(() => {
    const unsub = subscribeFiles(orgId, (incoming) => {
      if (incoming && incoming.length > 0) {
        setVaultFiles(incoming);
      }
    });
    return () => unsub();
  }, [orgId]);

  // Filter files
  const filteredFiles = useMemo(() => {
    return vaultFiles.filter(f => {
      // Destination filter
      if (selectedView === 'myself') {
        if (f.archiveDestination !== 'myself' && f.uploadedByUserId !== currentUserId) {
          return false;
        }
      } else {
        if (f.archiveDestination === 'myself') return false;
        if (f.deptId && f.deptId !== selectedView) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = f.name.toLowerCase().includes(q);
        const matchesUploader = (f.uploadedByName || '').toLowerCase().includes(q);
        const matchesSource = (f.integrationSource || '').toLowerCase().includes(q);
        if (!matchesName && !matchesUploader && !matchesSource) return false;
      }

      return true;
    });
  }, [vaultFiles, selectedView, searchQuery, currentUserId]);

  const handleCopyLink = (file: FileItem) => {
    const link = file.url || window.location.href;
    navigator.clipboard.writeText(link);
    setCopiedId(file.id);
    setTimeout(() => setCopiedId(null), 2000);
    setActiveMenuFileId(null);
  };

  const handleToggleDestination = async (file: FileItem) => {
    const newDest: 'department' | 'myself' = file.archiveDestination === 'myself' ? 'department' : 'myself';
    const updated: FileItem = {
      ...file,
      archiveDestination: newDest,
      archivedByUserId: newDest === 'myself' ? currentUserId : undefined,
      deptId: newDest === 'department' ? (file.deptId || selectedView !== 'myself' ? selectedView : depts[0]?.id || '') : file.deptId
    };

    // Update in state
    setVaultFiles(prev => prev.map(f => f.id === file.id ? updated : f));
    await upsertFileItem(updated);
    setActiveMenuFileId(null);
  };

  const handleRemoveFromVault = async (fileId: string) => {
    if (window.confirm('Remove this entry from Mika File Vault? (The original document or design is never deleted).')) {
      setVaultFiles(prev => prev.filter(f => f.id !== fileId));
      await removeFileItem(fileId);
      setActiveMenuFileId(null);
    }
  };

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemUrl.trim()) return;

    const newItem: FileItem = {
      id: `file_${Date.now()}`,
      orgId,
      deptId: itemDestination === 'department' ? (selectedView !== 'myself' ? selectedView : depts[0]?.id || '') : undefined,
      name: itemName.trim(),
      size: itemEntryType === 'full_import' ? '5.4 MB' : 'Link',
      type: itemSource === 'figma' ? 'application/x-figma' : itemSource === 'canva' ? 'application/x-canva' : 'text/html',
      url: itemUrl.trim(),
      uploadedByUserId: currentUserId,
      uploadedByName: currentUser?.name || 'Authorized Member',
      uploadedAt: new Date().toISOString(),
      archiveDestination: itemDestination,
      archivedByUserId: itemDestination === 'myself' ? currentUserId : undefined,
      entryType: itemEntryType,
      integrationSource: itemSource,
      thumbnailUrl: itemSource === 'figma' 
        ? 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&q=80'
        : itemSource === 'canva'
        ? 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=300&q=80'
        : 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=300&q=80'
    };

    setVaultFiles(prev => [newItem, ...prev]);
    await upsertFileItem(newItem);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    setShowAddModal(false);
    setItemName('');
    setItemUrl('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newItem: FileItem = {
      id: `file_${Date.now()}`,
      orgId,
      deptId: selectedView !== 'myself' ? selectedView : depts[0]?.id || '',
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
      type: file.type || 'application/octet-stream',
      url: URL.createObjectURL(file),
      uploadedByUserId: currentUserId,
      uploadedByName: currentUser?.name || 'Member',
      uploadedAt: new Date().toISOString(),
      archiveDestination: selectedView === 'myself' ? 'myself' : 'department',
      archivedByUserId: selectedView === 'myself' ? currentUserId : undefined,
      entryType: 'full_import',
      integrationSource: 'upload'
    };

    setVaultFiles(prev => [newItem, ...prev]);
    await upsertFileItem(newItem);
    confetti({ particleCount: 30, spread: 50 });
  };

  const getSourceBadge = (source?: string) => {
    switch (source) {
      case 'figma':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"><Figma className="w-3 h-3" /> Figma</span>;
      case 'canva':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-800"><Layers className="w-3 h-3" /> Canva</span>;
      case 'github':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-800"><Github className="w-3 h-3" /> GitHub</span>;
      case 'google_docs':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"><FileText className="w-3 h-3" /> Google Doc</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"><FileCheck className="w-3 h-3" /> File</span>;
    }
  };

  return (
    <div id="file-vault-root" className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">File Vault</h1>
          <p className="text-sm text-slate-500 mt-1">
            Department archives, private assets, and connected designs across Google, Figma, Canva, and GitHub.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button
            id="btn-upload-file"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition shadow-sm"
          >
            <Upload className="w-4 h-4 text-slate-500" />
            Upload File
          </button>
          <button
            id="btn-add-vault-entry"
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Link / Design
          </button>
        </div>
      </div>

      {/* Destination Tabs & Filter */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
        {/* Department / Myself Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            id="tab-view-myself"
            onClick={() => setSelectedView('myself')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
              selectedView === 'myself'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            Archived to Myself
          </button>

          <div className="h-5 w-[1px] bg-slate-200 mx-1" />

          {depts.map((d) => (
            <button
              key={d.id}
              id={`tab-view-dept-${d.id}`}
              onClick={() => setSelectedView(d.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                selectedView === d.id
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="input-vault-search"
            type="text"
            placeholder="Search vault files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
          />
        </div>
      </div>

      {/* Flat File List Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filteredFiles.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-base font-medium text-slate-900">No files in this destination</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              Archive files to this department or yourself, or import designs from connected Figma, Canva, and Google Drive integrations.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3">File / Asset</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Size / Type</th>
                  <th className="px-4 py-3">Uploaded By</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFiles.map((file) => {
                  const isMenuOpen = activeMenuFileId === file.id;
                  return (
                    <tr key={file.id} className="hover:bg-slate-50/75 transition">
                      {/* Name & Thumbnail */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          {file.thumbnailUrl ? (
                            <img 
                              src={file.thumbnailUrl} 
                              alt="" 
                              className="w-9 h-9 rounded object-cover border border-slate-200 bg-slate-100" 
                            />
                          ) : (
                            <div className="w-9 h-9 rounded bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                              <FileText className="w-5 h-5" />
                            </div>
                          )}
                          <div>
                            <a
                              href={file.url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="font-medium text-slate-900 hover:text-indigo-600 transition inline-flex items-center gap-1.5"
                            >
                              {file.name}
                              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                            </a>
                            <div className="text-xs text-slate-400">
                              {file.entryType === 'full_import' ? 'Full Snapshot' : 'Preview Link'}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Source */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getSourceBadge(file.integrationSource)}
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {file.archiveDestination === 'myself' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <FolderLock className="w-3 h-3" /> Myself
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            <Globe className="w-3 h-3" /> Department
                          </span>
                        )}
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {file.size}
                      </td>

                      {/* Uploaded By */}
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {file.uploadedByName}
                      </td>

                      {/* Three-Dot Menu */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap relative">
                        <button
                          id={`btn-menu-${file.id}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuFileId(isMenuOpen ? null : file.id);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                          <div 
                            className="absolute right-4 top-10 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1.5 z-30 text-left"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Toggle destination */}
                            <button
                              id={`menu-toggle-dest-${file.id}`}
                              onClick={() => handleToggleDestination(file)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                            >
                              <FolderSync className="w-4 h-4 text-slate-400" />
                              {file.archiveDestination === 'myself'
                                ? 'Move to Department'
                                : 'Move to Myself'}
                            </button>

                            {/* Open in native app in new tab */}
                            <a
                              id={`menu-open-${file.id}`}
                              href={file.url || '#'}
                              target="_blank"
                              rel="noreferrer"
                              onClick={() => setActiveMenuFileId(null)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                            >
                              <ExternalLink className="w-4 h-4 text-slate-400" />
                              Open in native app
                            </a>

                            {/* Copy link */}
                            <button
                              id={`menu-copy-${file.id}`}
                              onClick={() => handleCopyLink(file)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition"
                            >
                              {copiedId === file.id ? (
                                <>
                                  <Check className="w-4 h-4 text-green-600" />
                                  <span className="text-green-600">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-4 h-4 text-slate-400" />
                                  Copy link
                                </>
                              )}
                            </button>

                            <div className="h-[1px] bg-slate-100 my-1" />

                            {/* Remove from vault */}
                            <button
                              id={`menu-remove-${file.id}`}
                              onClick={() => handleRemoveFromVault(file.id)}
                              className="w-full px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 transition"
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                              Remove from vault
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-lg font-semibold text-slate-900">Add Entry to File Vault</h2>
            <p className="text-xs text-slate-500 mt-1">
              Add a live design or document reference from Figma, Canva, Google Drive, or GitHub.
            </p>

            <form onSubmit={handleCreateEntry} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Source Application</label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemSource('figma')}
                    className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition ${
                      itemSource === 'figma' ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Figma className="w-4 h-4" /> Figma
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemSource('canva')}
                    className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition ${
                      itemSource === 'canva' ? 'border-cyan-600 bg-cyan-50 text-cyan-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Layers className="w-4 h-4" /> Canva
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemSource('google_docs')}
                    className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition ${
                      itemSource === 'google_docs' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <FileText className="w-4 h-4" /> Docs
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemSource('github')}
                    className={`p-2 rounded-lg border text-xs font-medium flex flex-col items-center gap-1 transition ${
                      itemSource === 'github' ? 'border-slate-800 bg-slate-100 text-slate-900' : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <Github className="w-4 h-4" /> GitHub
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Title / Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brand Identity Kit v2"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">External Link / URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={itemUrl}
                  onChange={(e) => setItemUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Archive Destination</label>
                  <select
                    value={itemDestination}
                    onChange={(e) => setItemDestination(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="department">Archived to Department</option>
                    <option value="myself">Archived to Myself (Private)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Storage Mode</label>
                  <select
                    value={itemEntryType}
                    onChange={(e) => setItemEntryType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="preview_link">Preview Link Entry</option>
                    <option value="full_import">Full Import (Snapshot)</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-sm"
                >
                  Add to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
