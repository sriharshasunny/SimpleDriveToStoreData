import { useState, useEffect, useContext } from 'react';
import { getDrive, uploadFile, createFolder, deleteFile, deleteFolder, renameFile, renameFolder, toggleFile, toggleFolder, downloadFile, extractFile, downloadZip } from '../api';
import Sidebar from '../components/Sidebar';
import FileGrid from '../components/FileGrid';
import ContextMenu from '../components/ContextMenu';
import FilePreview from '../components/FilePreview';
import { Search, Plus, Upload, Loader2, Trash2, Edit2, Eye, Download, Star, Undo, LogOut } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';

function Drive() {
  const { user, logout } = useContext(AuthContext);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [currentFilter, setCurrentFilter] = useState(null);
  const [data, setData] = useState({ files: [], folders: [], breadcrumbs: [] });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Advanced State
  const [previewFile, setPreviewFile] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedItems, setSelectedItems] = useState(new Set()); 

  const fetchData = async (folderId = null, filter = null, search = '') => {
    setLoading(true);
    try {
      const result = await getDrive(folderId, filter, search);
      setData(result);
      if (!filter && !search) setCurrentFolder(folderId);
    } catch (error) {
      console.error("Failed to fetch data", error);
      if(error.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(null, null);
  }, []);

  const handleFilterChange = (filter) => {
    setCurrentFilter(filter);
    setCurrentFolder(null);
    fetchData(null, filter);
  };

  const handleFolderClick = (folderId) => {
    if (currentFilter) {
      setCurrentFilter(null);
    }
    fetchData(folderId);
  };

  const handleBreadcrumbClick = (folderId) => {
    setCurrentFilter(null);
    fetchData(folderId);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (currentFilter && currentFilter !== 'recent') {
      alert("Can only upload in My Drive");
      return;
    }

    setUploading(true);
    try {
      await uploadFile(file, currentFolder);
      fetchData(currentFolder, currentFilter);
    } catch (error) {
      console.error(error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (currentFilter) {
      alert("Cannot create folders here");
      return;
    }
    const name = prompt("Enter folder name:");
    if (!name) return;

    try {
      await createFolder(name, currentFolder);
      fetchData(currentFolder, currentFilter);
    } catch (error) {
      alert("Failed to create folder");
    }
  };

  const handleSelection = (e, item, type) => {
    const id = `${type}-${item.id}`;
    const newSelected = new Set(e.ctrlKey || e.metaKey ? selectedItems : []);

    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const clearSelection = () => setSelectedItems(new Set());

  const handleDelete = async (item = null, type = null) => {
    let itemsToDelete = [];
    if (item) {
      itemsToDelete.push({ id: item.id, type });
    } else {
      selectedItems.forEach(key => {
        const [t, i] = key.split('-');
        itemsToDelete.push({ id: i, type: t });
      });
    }

    if (itemsToDelete.length === 0) return;
    if (!confirm(`Delete ${itemsToDelete.length} item(s)?`)) return;

    try {
      for (const i of itemsToDelete) {
        if (i.type === 'file') await deleteFile(i.id);
        else await deleteFolder(i.id);
      }
      setSelectedItems(new Set());
      fetchData(currentFolder, currentFilter);
    } catch (error) {
      alert("Failed to delete some items");
    }
  };

  const handleToggleStar = async (item, type) => {
    try {
      const newStatus = !item.isStarred;
      if (type === 'file') await toggleFile(item.id, { isStarred: newStatus });
      else await toggleFolder(item.id, { isStarred: newStatus });
      fetchData(currentFolder, currentFilter);
    } catch (error) {
      alert("Failed to update star");
    }
  }

  const handleToggleTrash = async (item, type) => {
    try {
      const newStatus = !item.isTrashed; 
      if (type === 'file') await toggleFile(item.id, { isTrashed: newStatus });
      else await toggleFolder(item.id, { isTrashed: newStatus });
      fetchData(currentFolder, currentFilter);
    } catch (error) {
      alert("Failed to update trash");
    }
  }

  const handleRename = async (item, type) => {
    const newName = prompt("Rename to:", item.name);
    if (!newName || newName === item.name) return;

    try {
      if (type === 'file') await renameFile(item.id, newName);
      else await renameFolder(item.id, newName);
      fetchData(currentFolder, currentFilter);
    } catch (error) {
      alert("Failed to rename");
    }
  };

  const handleContextMenu = (e, item, type) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item,
      type
    });
  };

  const getContextMenuOptions = () => {
    if (!contextMenu) return [];

    const { item, type } = contextMenu;
    const options = [];

    if (type === 'file' || type === 'folder') {
      if (type === 'folder') {
        options.push({ label: 'Open', icon: Eye, onClick: () => handleFolderClick(item.id) });
        options.push({ label: 'Download as Zip', icon: Download, onClick: () => downloadZip([{ id: item.id, type: 'folder' }]) });
      } else {
        options.push({ label: 'Preview', icon: Eye, onClick: () => setPreviewFile(item) });
      }

      if (type === 'file' && (item.name.endsWith('.zip') || item.type === 'application/zip')) {
        options.push({
          label: 'Extract Here',
          icon: Download,
          onClick: async () => {
            try {
              await extractFile(item.id);
              fetchData(currentFolder, currentFilter);
              alert('Extraction complete');
            } catch (e) {
              alert('Extraction failed');
            }
          }
        });
      }

      options.push({
        label: item.isStarred ? 'Remove Star' : 'Add Star',
        icon: Star,
        onClick: () => handleToggleStar(item, type)
      });

      options.push({ label: 'Rename', icon: Edit2, onClick: () => handleRename(item, type) });

      if (type === 'file') {
        options.push({ label: 'Download', icon: Download, onClick: () => downloadFile(item.id, item.name) });
      }

      const isTrashed = item.isTrashed;
      options.push({
        label: isTrashed ? 'Restore' : 'Move to Trash',
        icon: isTrashed ? Undo : Trash2,
        onClick: () => handleToggleTrash(item, type)
      });

      if (isTrashed) {
        options.push({ label: 'Delete Forever', icon: Trash2, onClick: () => handleDelete(item, type) });
      }

    } else {
      options.push({ label: 'New Folder', icon: Plus, onClick: handleCreateFolder });
    }

    return options;
  };

  return (
    <div className="flex h-screen bg-transparent font-[Inter]" onClick={() => setContextMenu(null)}>
      <Sidebar
        currentFilter={currentFilter}
        onFilterChange={handleFilterChange}
        usage={data.usage || 0}
      />

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header */}
        <header className="h-20 flex items-center px-8 justify-between shrink-0 bg-transparent">
          <div className="flex items-center bg-white/5 backdrop-blur-xl rounded-2xl px-5 py-3 w-96 shadow-lg border border-white/10 focus-within:ring-1 ring-indigo-500/50 transition-all focus-within:bg-white/10 focus-within:shadow-indigo-500/20">
            <Search className="w-5 h-5 text-indigo-400 mr-3" />
            <input
              type="text"
              placeholder="Search your files..."
              className="bg-transparent border-none outline-none w-full text-base placeholder-slate-500 text-slate-200 font-medium"
              onChange={(e) => {
                const val = e.target.value;
                if (val.length > 1 || val.length === 0) fetchData(null, null, val);
              }}
            />
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-600 to-purple-600 border border-white/20 flex items-center justify-center font-bold text-white shadow-lg">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex flex-col text-sm hidden sm:block">
                <span className="text-white font-medium">{user?.name}</span>
                <span className="text-slate-400 text-xs">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={logout}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors border border-white/5 text-slate-300 hover:text-red-400"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Toolbar & Breadcrumbs */}
        <div className="px-8 pb-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2 text-gray-600 text-lg">
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-100 to-blue-200">
              {currentFilter === 'recent' ? 'Recent Files' :
                currentFilter === 'starred' ? 'Starred' :
                  currentFilter === 'trash' ? 'Trash' : 'My Drive'}
            </h1>
            {!currentFilter && data.breadcrumbs.map((crumb) => (
              <div key={crumb.id} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                <span className="text-slate-600">/</span>
                <button
                  onClick={() => handleBreadcrumbClick(crumb.id)}
                  className={`hover:bg-white/5 px-3 py-1 rounded-lg transition-colors text-slate-400 hover:text-cyan-200 ${currentFolder === crumb.id ? 'font-semibold text-cyan-50' : ''}`}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            {!currentFilter && (
              <>
                <button
                  onClick={handleCreateFolder}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/5 backdrop-blur hover:bg-white/10 text-cyan-50 rounded-2xl shadow-lg border border-white/10 hover:border-cyan-500/30 transition-all text-sm font-semibold"
                >
                  <Plus className="w-4 h-4 text-cyan-400" /> New Folder
                </button>
                <label className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:-translate-y-0.5 transition-all cursor-pointer text-sm font-semibold shadow-lg border border-white/10">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  <span>File Upload</span>
                  <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
                </label>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div
          className="flex-1 overflow-auto px-8 pb-8 relative z-0"
          onContextMenu={(e) => handleContextMenu(e, null, 'bg')}
          onClick={() => { if (selectedItems.size > 0) clearSelection(); }}
        >
          {/* Aurora Background */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10 bg-[#02040a]">
            <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] bg-blue-600/10 rounded-full blur-[100px] animate-blob"></div>
            <div className="absolute top-[20%] -right-[10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>
            <div className="absolute -bottom-[20%] left-[20%] w-[70%] h-[70%] bg-cyan-600/10 rounded-full blur-[100px] animate-blob animation-delay-4000"></div>
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150 mix-blend-overlay"></div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-full text-slate-400">
               <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <FileGrid
                folders={data.folders}
                files={data.files}
                onFolderClick={handleFolderClick}
                onFileClick={setPreviewFile}
                onContextMenu={handleContextMenu}
                onSelection={handleSelection}
                selectedItems={selectedItems}
              />
              <div className="h-20"></div>
            </>
          )}
        </div>

        {/* Floating Bulk Action Bar */}
        {selectedItems.size > 0 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#0f111a]/90 backdrop-blur-xl border border-white/10 text-white px-6 py-3 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in duration-300 z-50">
            <span className="text-cyan-400 font-semibold text-sm border-r border-white/10 pr-6">{selectedItems.size} Selected</span>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const items = [];
                  selectedItems.forEach(key => {
                    const [t, i] = key.split('-');
                    items.push({ id: i, type: t });
                  });
                  downloadZip(items);
                }}
                className="p-2 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-400 rounded-lg transition-colors flex flex-col items-center gap-1 group relative"
              >
                <Download className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 absolute -top-8 bg-black px-2 py-1 rounded w-max">Download Zip</span>
              </button>

              <button onClick={() => handleDelete()} className="p-2 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded-lg transition-colors flex flex-col items-center gap-1 group relative">
                <Trash2 className="w-5 h-5" />
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-0 group-hover:opacity-100 absolute -top-8 bg-black px-2 py-1 rounded">Delete</span>
              </button>
            </div>

            <button onClick={clearSelection} className="ml-4 text-xs text-slate-500 hover:text-slate-300">Cancel</button>
          </div>
        )}

        {/* Overlays */}
        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            options={getContextMenuOptions()}
            onClose={() => setContextMenu(null)}
          />
        )}

        {previewFile && (
          <FilePreview
            file={previewFile}
            onClose={() => setPreviewFile(null)}
          />
        )}

      </div>
    </div>
  );
}

export default Drive;
