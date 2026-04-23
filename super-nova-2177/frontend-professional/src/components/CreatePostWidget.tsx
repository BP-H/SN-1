import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Image, FileText, X, Send, Loader2 } from 'lucide-react';

export const CreatePostWidget: React.FC = () => {
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [link, setLink] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async () => {
        if (!title.trim() || !user) return;
        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('description', description);
            formData.append('userName', user.username);
            formData.append('userInitials', user.username.slice(0, 2).toUpperCase());
            formData.append('author_type', user.species || 'human');
            if (link) formData.append('link', link);
            if (file) formData.append('file', file);

            await api.createProposal(formData);
            setSuccess(true);
            setTitle('');
            setDescription('');
            setLink('');
            setFile(null);
            setTimeout(() => {
                setIsModalOpen(false);
                setSuccess(false);
                window.location.reload();
            }, 1200);
        } catch (err) {
            console.error("Failed to create post", err);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <div className="bg-white mb-2 p-4 pb-2">
                <div className="flex gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-xs">
                                {user?.username?.[0]?.toUpperCase() || 'U'}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex-1 text-left border border-gray-300 rounded-full px-4 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                        Start a post
                    </button>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => !submitting && setIsModalOpen(false)}>
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                                    <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-sm">
                                        {user?.username?.[0]?.toUpperCase() || 'U'}
                                    </div>
                                </div>
                                <div>
                                    <div className="font-semibold text-sm">{user?.username || 'User'}</div>
                                    <div className="text-xs text-gray-500">Post to Anyone</div>
                                </div>
                            </div>
                            <button onClick={() => !submitting && setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 space-y-3">
                            <input
                                type="text"
                                placeholder="Title *"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-professional-blue outline-none"
                            />
                            <textarea
                                placeholder="What do you want to talk about?"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                rows={4}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-professional-blue outline-none resize-none"
                            />
                            <input
                                type="url"
                                placeholder="Add a link (optional)"
                                value={link}
                                onChange={e => setLink(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm focus:border-professional-blue outline-none"
                            />
                            {file && (
                                <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm">
                                    <FileText size={16} className="text-gray-500" />
                                    <span className="truncate flex-1">{file.name}</span>
                                    <button onClick={() => setFile(null)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center p-4 border-t">
                            <div className="flex gap-2">
                                <input ref={fileRef} type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
                                <button onClick={() => fileRef.current?.click()} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
                                    <Image size={20} />
                                </button>
                            </div>
                            <button
                                onClick={handleSubmit}
                                disabled={!title.trim() || submitting}
                                className="bg-professional-blue text-white font-semibold px-6 py-2 rounded-full disabled:opacity-50 hover:bg-professional-dark-blue transition-colors flex items-center gap-2"
                            >
                                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                {success ? 'Posted!' : 'Post'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
