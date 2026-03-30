import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api',
});

// Request interceptor to attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const getDrive = async (folderId = null, filter = null, search = '') => {
    const params = {};
    if (folderId) params.parentId = folderId;
    if (filter) params.filter = filter;
    if (search && search.length > 0) params.search = search;

    const response = await api.get('/drive', { params });
    return response.data;
};

export const createFolder = async (name, parentId = null) => {
    const response = await api.post('/folders', { name, parentId });
    return response.data;
};

export const uploadFile = async (file, folderId = null) => {
    console.log(`[API] Uploading file: ${file.name} to folder: ${folderId}`);
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);

    try {
        const response = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        console.log('[API] Upload success:', response.data);
        return response.data;
    } catch (error) {
        console.error('[API] Upload failed:', error.response?.data || error.message);
        throw error;
    }
};

export const downloadFile = async (id, name) => {
    try {
        const response = await api.get(`/files/${id}/download`, {
            responseType: 'blob',
        });

        // Create a link to download the blob
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', name); // Use custom name or from header
        document.body.appendChild(link);
        link.click();

        // Cleanup
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Download failed:", error);
        throw error;
    }
};
export const downloadFileUrl = (id) => `http://localhost:3001/api/files/${id}/download`;

export const deleteFile = async (id) => {
    await api.delete(`/files/${id}`);
};

export const deleteFolder = async (id) => {
    await api.delete(`/folders/${id}`);
};

export const renameFile = async (id, name) => {
    await api.put(`/files/${id}`, { name });
};

export const renameFolder = async (id, name) => {
    await api.put(`/folders/${id}`, { name });
};

export const toggleFile = async (id, data) => {
    await api.put(`/files/${id}/toggle`, data);
};

export const toggleFolder = async (id, data) => {
    await api.put(`/folders/${id}/toggle`, data);
};

export const extractFile = async (id) => {
    const response = await api.post(`/files/${id}/extract`);
    return response.data;
};

export const downloadZip = async (items) => {
    try {
        const response = await api.post('/download-zip', { items }, {
            responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'download.zip');
        document.body.appendChild(link);
        link.click();

        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Zip Download failed:", error);
        throw error;
    }
};

export default api;
