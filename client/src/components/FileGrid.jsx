import { Folder, File as FileIcon, MoreVertical, Download, Star, Trash2 } from 'lucide-react';
import { downloadFileUrl } from '../api';
import { cn } from '../utils';

const FileGrid = ({ folders, files, onFolderClick, onFileClick, onContextMenu, onSelection, selectedItems }) => {
    if (folders.length === 0 && files.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-in fade-in duration-500">
                <div className="bg-white/50 backdrop-blur-sm p-12 rounded-3xl mb-4 shadow-xl border border-white/60">
                    <img src="https://ssl.gstatic.com/docs/doclist/images/empty_state_apps_2x.png" className="w-40 opacity-50 grayscale hover:grayscale-0 transition-all duration-500" alt="Empty" />
                </div>
                <p className="text-lg font-medium text-gray-500">This folder is empty</p>
            </div>
        );
    }

    // Helper for selection class
    const getSelectionClass = (id, type) => {
        // Check if selectedItems has this ID (App component manages the Set)
        // We expect selectedItems to be a Set of strings "type-id"
        if (!selectedItems) return 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5';

        return selectedItems.has(`${type}-${id}`)
            ? 'bg-cyan-500/20 border-cyan-500/50 shadow-[0_0_15px_rgba(34,211,238,0.2)] ring-1 ring-cyan-400/30'
            : 'bg-white/[0.03] hover:bg-white/[0.08] border-white/5';
    };

    return (
        <div className="space-y-10 pb-20 p-2" onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, null, 'bg'); }}>

            {/* Folders Section */}
            {folders.length > 0 && (
                <section className="animate-in slide-in-from-bottom-4 duration-500 fade-in">
                    <h2 className="text-sm font-bold text-cyan-500/50 mb-4 px-1 uppercase tracking-wider">Folders</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-5">
                        {folders.map((folder) => (
                            <div
                                key={folder.id}
                                onClick={(e) => onSelection && onSelection(e, folder, 'folder')}
                                onDoubleClick={() => onFolderClick(folder.id)}
                                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, folder, 'folder'); }}
                                className={cn(
                                    "group relative flex items-center justify-between p-4 backdrop-blur-md border rounded-2xl cursor-pointer select-none shadow-lg transition-all duration-300",
                                    "hover:shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:-translate-y-1 hover:border-cyan-500/20",
                                    getSelectionClass(folder.id, 'folder'),
                                    folder.isTrashed && "opacity-50 grayscale border-red-500/20 bg-red-500/10"
                                )}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 border border-cyan-500/20">
                                        <Folder className="w-5 h-5 text-cyan-400 fill-cyan-400/20" />
                                    </div>
                                    <span className="text-sm font-medium text-cyan-50 truncate">{folder.name}</span>
                                </div>
                                {folder.isStarred && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 absolute top-2 right-2" />}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onContextMenu(e, folder, 'folder'); }}
                                    className="p-1.5 hover:bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <MoreVertical className="w-4 h-4 text-gray-500" />
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Files Section */}
            {files.length > 0 && (
                <section className="animate-in slide-in-from-bottom-8 duration-700 fade-in">
                    <h2 className="text-sm font-bold text-cyan-500/50 mb-4 px-1 uppercase tracking-wider">Files</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                        {/* Files Map */}
                        {files.map((file) => (
                            <div
                                key={file.id}
                                className={cn(
                                    "group relative flex flex-col justify-between p-3 bg-[#161b22] border border-white/5 rounded-2xl cursor-pointer h-48 select-none transition-all duration-200",
                                    "hover:bg-[#1c2128] hover:border-white/10",
                                    getSelectionClass(file.id, 'file'),
                                    file.isTrashed && "opacity-50 grayscale"
                                )}
                                onClick={(e) => onSelection && onSelection(e, file, 'file')}
                                onDoubleClick={() => onFileClick(file)}
                                onContextMenu={(e) => { e.stopPropagation(); onContextMenu(e, file, 'file'); }}
                            >
                                {/* File Preview / Icon Area */}
                                <div className="flex-1 flex items-center justify-center mb-3 bg-black/20 rounded-xl overflow-hidden relative">
                                    {file.type.startsWith('image/') ? (
                                        <img src={`http://localhost:3001/uploads/${file.path}`} className="w-full h-full object-cover opacity-90 transition-opacity group-hover:opacity-100" alt={file.name} loading="lazy" />
                                    ) : (
                                        <FileIcon className="w-10 h-10 text-cyan-500/80 group-hover:text-cyan-400 transition-colors" />
                                    )}
                                    {file.isStarred && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 absolute top-2 right-2" />}
                                </div>

                                {/* Footer Info */}
                                <div className="flex items-center justify-between gap-2 px-1">
                                    <div className="flex-1 overflow-hidden">
                                        <h3 className="text-xs font-semibold text-gray-200 truncate" title={file.name}>{file.name}</h3>
                                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">{(file.size / 1024).toFixed(0)} KB</p>
                                    </div>

                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); window.location.href = downloadFileUrl(file.id); }}
                                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                            title="Download"
                                        >
                                            <Download className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onContextMenu(e, file, 'file'); }}
                                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white transition-colors"
                                        >
                                            <MoreVertical className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
};

export default FileGrid;
