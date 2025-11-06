import React, { useState, useRef } from 'react';
import { XIcon, LoadingIcon, UploadIcon, CheckIcon } from './Icons';

type BulkImportMode = 'full_recipes' | 'meal_ideas';

interface BulkImportModalProps {
    onClose: () => void;
    onBulkImport: (
        documentText: string, 
        importMode: BulkImportMode,
        onProgress: (message: string) => void,
        onComplete: (count: number) => void
    ) => Promise<void>;
}

type ImportStatus = 'idle' | 'reading' | 'processing' | 'error' | 'success';

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onBulkImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<BulkImportMode>('full_recipes');
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [successCount, setSuccessCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setFile(event.target.files[0]);
            setStatus('idle');
            setProgressMessage('');
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setStatus('reading');
        setProgressMessage('Reading file...');

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                if (!text) {
                    throw new Error("Could not read text from the file.");
                }
                setStatus('processing');
                await onBulkImport(
                    text,
                    importMode,
                    (message) => setProgressMessage(message),
                    (count) => {
                        setStatus('success');
                        setSuccessCount(count);
                    }
                );
            } catch (err: any) {
                setStatus('error');
                setProgressMessage(err.message || 'An unknown error occurred during import.');
            }
        };
        reader.onerror = () => {
            setStatus('error');
            setProgressMessage('Failed to read the selected file.');
        };
        reader.readAsText(file);
    };
    
    const isProcessing = status === 'reading' || status === 'processing';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Bulk Import Recipes</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600" disabled={isProcessing}>
                        <XIcon />
                    </button>
                </div>
                
                <div className="p-6">
                    {status !== 'success' && (
                        <>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">What kind of document are you uploading?</label>
                                <div className="flex space-x-4">
                                    <label className="flex-1 p-3 border rounded-lg cursor-pointer transition-colors" data-active={importMode === 'full_recipes'}>
                                        <input type="radio" name="import-mode" value="full_recipes" checked={importMode === 'full_recipes'} onChange={() => setImportMode('full_recipes')} className="sr-only" />
                                        <div className="font-semibold text-gray-800">Full Recipes</div>
                                        <div className="text-xs text-gray-500">A document with names, ingredients, and instructions.</div>
                                    </label>
                                    <label className="flex-1 p-3 border rounded-lg cursor-pointer transition-colors" data-active={importMode === 'meal_ideas'}>
                                        <input type="radio" name="import-mode" value="meal_ideas" checked={importMode === 'meal_ideas'} onChange={() => setImportMode('meal_ideas')} className="sr-only" />
                                        <div className="font-semibold text-gray-800">Meal Ideas</div>
                                        <div className="text-xs text-gray-500">A list of recipe titles (e.g., from a Word doc).</div>
                                    </label>
                                </div>
                                <style>{`
                                    label[data-active='true'] { border-color: #3b82f6; background-color: #eff6ff; }
                                `}</style>
                            </div>

                             <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-600 mb-4">
                                <strong>Tip:</strong> For best results, use text-based files (`.txt`, `.md`, `.csv`). If you have a `.docx` or `.pdf`, copy-pasting the content into a plain text file first works best.
                            </div>

                            <div 
                                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 bg-gray-50 hover:bg-blue-50 transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input 
                                    type="file" 
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                    className="hidden"
                                    accept=".txt,.md,.csv,.doc,.docx,application/pdf"
                                />
                                <div className="mx-auto h-12 w-12 text-gray-400">
                                    <UploadIcon />
                                </div>
                                <p className="mt-2 text-sm text-gray-600">
                                    {file ? (
                                        <>Selected file: <span className="font-semibold text-gray-800">{file.name}</span></>
                                    ) : (
                                        "Click to select a file"
                                    )}
                                </p>
                                <p className="text-xs text-gray-500">TXT, MD, CSV recommended</p>
                            </div>
                        </>
                    )}
                    
                    {(isProcessing || status === 'error' || status === 'success') && (
                         <div className="mt-4 p-4 bg-gray-100 rounded-md text-center">
                            {isProcessing && <LoadingIcon />}
                            {status === 'success' && <div className="mx-auto h-8 w-8 text-green-500"><CheckIcon/></div>}
                            <p className="text-sm font-medium text-gray-800 mt-2">
                                {status === 'success' ? `Success!` : progressMessage}
                            </p>
                            {status === 'success' && <p className="text-xs text-gray-600">{successCount} recipes were imported.</p>}
                         </div>
                    )}
                    
                </div>
                
                <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        disabled={isProcessing}
                    >
                        {status === 'success' ? 'Done' : 'Cancel'}
                    </button>
                    {status !== 'success' && (
                        <button 
                            type="button" 
                            onClick={handleImport} 
                            disabled={!file || isProcessing} 
                            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
                        >
                            {isProcessing ? <LoadingIcon /> : <UploadIcon />}
                            <span className="ml-2">{status === 'processing' ? 'Processing...' : 'Import Recipes'}</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkImportModal;
