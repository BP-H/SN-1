import React, { useState, useRef } from 'react';
import { LiquidGlass } from './LiquidGlass';
import { X, Image as ImageIcon, Film, Send, Link as LinkIcon, FileText } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import imageCompression from 'browser-image-compression';

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CreatePostModal: React.FC<CreatePostModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [mediaType, setMediaType] = useState<'text' | 'image' | 'video' | 'link' | 'file'>('text');
    const [mediaValue, setMediaValue] = useState(''); // For link or text input of media
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'file') => {
        if (e.target.files && e.target.files[0]) {
            let file = e.target.files[0];
            if (type === 'image') {
                try {
                    const options = {
                        maxSizeMB: 1,
                        maxWidthOrHeight: 1920,
                        useWebWorker: true
                    };
                    file = await imageCompression(file, options);
                } catch (error) {
                    console.error("Image compression failed", error);
                }
            }
            setSelectedFile(file);
            setMediaType(type);
            setMediaValue(file.name);
        }
    };

    const triggerFileSelect = (type: 'image' | 'video' | 'file') => {
        if (fileInputRef.current) {
            fileInputRef.current.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : '*/*';
            fileInputRef.current.click();
        }
    };

    const handleSubmit = async () => {
        if (!content && !mediaValue && !selectedFile) return;
        setIsSubmitting(true);

        try {
            const formData = new FormData();
            formData.append('title', title);
            formData.append('body', content);
            formData.append('author', user?.username || 'Traveler');
            formData.append('userName', user?.username || 'Traveler');
            formData.append('userInitials', (user?.username || 'TR').slice(0, 2).toUpperCase());
            formData.append('author_type', user?.species || 'human');
            formData.append('author_img', user?.avatar || '');
            formData.append('date', new Date().toISOString());

            if (mediaType === 'image' && selectedFile) formData.append('image', selectedFile);
            if (mediaType === 'video' && selectedFile) formData.append('video', selectedFile);
            if (mediaType === 'file' && selectedFile) formData.append('file', selectedFile);
            if (mediaType === 'link' && mediaValue) formData.append('link', mediaValue);

            // If video is a URL (not file)
            if (mediaType === 'video' && !selectedFile && mediaValue) formData.append('video', mediaValue);

            await api.createProposal(formData);

            onClose();
            setContent('');
            setTitle('');
            setMediaType('text');
            setMediaValue('');
            setSelectedFile(null);
        } catch (e) {
            console.error("Failed to post", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <LiquidGlass className="w-full max-w-lg rounded-3xl animate-float">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-orbitron font-bold text-white">Broadcast Resonance</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-white">
                            <X size={24} />
                        </button>
                    </div>

                    <input
                        type="text"
                        placeholder="Title (Optional)"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full bg-black/20 border-b border-white/10 p-2 text-white mb-4 focus:outline-none focus:border-nova-cyan placeholder:text-gray-600 font-bold"
                    />

                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        placeholder="What is resonating in the neural lattice?"
                        className="w-full h-32 bg-transparent text-white resize-none focus:outline-none placeholder:text-gray-600 font-mono text-sm"
                    />

                    {/* Media Preview / Input */}
                    {(mediaType !== 'text') && (
                        <div className="mb-4 p-3 bg-white/5 rounded-xl flex items-center justify-between">
                            <div className="flex items-center gap-2 overflow-hidden">
                                {mediaType === 'link' ? <LinkIcon size={16} className="text-nova-cyan" /> : <FileText size={16} className="text-nova-purple" />}

                                {mediaType === 'link' ? (
                                    <input
                                        type="text"
                                        value={mediaValue}
                                        onChange={e => setMediaValue(e.target.value)}
                                        placeholder="Paste link here..."
                                        className="bg-transparent border-none focus:outline-none text-white text-sm w-full"
                                        autoFocus
                                    />
                                ) : (
                                    <span className="text-sm text-gray-300 truncate">{mediaValue || 'Select file...'}</span>
                                )}
                            </div>
                            <button onClick={() => { setMediaType('text'); setMediaValue(''); setSelectedFile(null); }} className="text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileChange(e, mediaType as any)} />

                    <div className="flex gap-2 mb-6 mt-4">
                        <button
                            onClick={() => triggerFileSelect('image')}
                            className={`p-2 rounded-lg transition-colors ${mediaType === 'image' ? 'bg-nova-pink text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            title="Upload Image"
                        >
                            <ImageIcon size={20} />
                        </button>
                        <button
                            onClick={() => triggerFileSelect('video')}
                            className={`p-2 rounded-lg transition-colors ${mediaType === 'video' ? 'bg-nova-purple text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            title="Upload Video"
                        >
                            <Film size={20} />
                        </button>
                        <button
                            onClick={() => { setMediaType('link'); setMediaValue(''); }}
                            className={`p-2 rounded-lg transition-colors ${mediaType === 'link' ? 'bg-nova-cyan text-white' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            title="Add Link"
                        >
                            <LinkIcon size={20} />
                        </button>
                        <button
                            onClick={() => triggerFileSelect('file')}
                            className={`p-2 rounded-lg transition-colors ${mediaType === 'file' ? 'bg-nova-acid text-black' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                            title="Upload File"
                        >
                            <FileText size={20} />
                        </button>
                    </div>

                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!content && !mediaValue && !selectedFile)}
                        className="w-full bg-gradient-to-r from-nova-cyan to-nova-purple text-white font-bold py-3 rounded-xl shadow-lg shadow-nova-purple/20 hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? 'Broadcasting...' : <><Send size={18} /> Transmit</>}
                    </button>
                </div>
            </LiquidGlass>
        </div>
    );
};
