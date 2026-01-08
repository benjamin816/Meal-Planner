
import React, { useState, useRef, useEffect } from 'react';
import { XIcon, LoadingIcon, UploadIcon, CheckIcon } from './Icons';

type BulkImportMode = 'full_recipes' | 'meal_ideas';

interface BulkImportModalProps {
    onClose: () => void;
    onBulkImport: (
        sourceFile: File, 
        importMode: BulkImportMode,
        onProgress: (message: string, percentage: number) => void,
        onComplete: (count: number) => void,
        abortSignal: { isCancelled: boolean }
    ) => Promise<void>;
}

type ImportStatus = 'idle' | 'processing' | 'error' | 'success';

const BulkImportModal: React.FC<BulkImportModalProps> = ({ onClose, onBulkImport }) => {
    const [file, setFile] = useState<File | null>(null);
    const [importMode, setImportMode] = useState<BulkImportMode>('full_recipes');
    const [status, setStatus] = useState<ImportStatus>('idle');
    const [progressMessage, setProgressMessage] = useState<string>('');
    const [percentage, setPercentage] = useState(0);
    const [estTimeRemaining, setEstTimeRemaining] = useState<number | null>(null);
    const [successCount, setSuccessCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Ref to handle cancellation if modal is closed during processing
    const abortSignal = useRef({ isCancelled: false });
    const countdownTimerRef = useRef<number | null>(null);

    useEffect(() => {
        return () => {
            // Cleanup on unmount
            abortSignal.current.isCancelled = true;
            if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        };
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setFile(event.target.files[0]);
            setStatus('idle');
            setProgressMessage('');
            setPercentage(0);
        }
    };

    const handleImport = async () => {
        if (!file) return;

        setStatus('processing');
        setPercentage(0);
        abortSignal.current.isCancelled = false;
        
        // Initial time estimation: ~25s for Phase 1 (AI generation)
        setEstTimeRemaining(25);
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = window.setInterval(() => {
            setEstTimeRemaining(prev => (prev !== null && prev > 1) ? prev - 1 : prev);
        }, 1000);

        try {
            await onBulkImport(
                file,
                importMode,
                (message, pct) => {
                    if (!abortSignal.current.isCancelled) {
                        setProgressMessage(message);
                        setPercentage(pct);
                        
                        // Refine time estimate once Phase 2 (Individual processing) begins at 60%
                        if (pct >= 60 && countdownTimerRef.current) {
                            // Phase 2 estimate: ~2s per remaining work unit
                            // We don't have the exact count here easily, so we just let it drift down
                            // if needed, the parent can provide more info, but for now simple is better.
                        }
                    }
                },
                (count) => {
                    if (!abortSignal.current.isCancelled) {
                        setStatus('success');
                        setPercentage(100);
                        setSuccessCount(count);
                        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                        setEstTimeRemaining(null);
                    }
                },
                abortSignal.current
            );
        } catch (err: any) {
            if (!abortSignal.current.isCancelled) {
                setStatus('error');
                setProgressMessage(err.message || 'An unknown error occurred during import.');
                if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
                setEstTimeRemaining(null);
            }
        }
    };

    const handleCancelClose = () => {
        abortSignal.current.isCancelled = true;
        if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
        onClose();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-gray-800">Bulk Import Recipes</h2>
                    <button onClick={handleCancelClose} className="text-gray-400 hover:text-gray-600">
                        <XIcon />
                    </button>
                </div>
                
                <div className="p-6">
                    {status !== 'success' && (
                        <>
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">What kind of file are you uploading?</label>
                                <div className="flex space-x-4">
                                    <label className="flex-1 p-3 border rounded-lg cursor-pointer transition-colors" data-active={importMode === 'full_recipes'}>
                                        <input type="radio" name="import-mode" value="full_recipes" checked={importMode === 'full_recipes'} onChange={() => setImportMode('full_recipes')} className="sr-only" />
                                        <div className="font-semibold text-gray-800 text-sm">Full Recipes</div>
                                        <div className="text-[10px] text-gray-500">Extracts existing ingredients & steps.</div>
                                    </label>
                                    <label className="flex-1 p-3 border rounded-lg cursor-pointer transition-colors" data-active={importMode === 'meal_ideas'}>
                                        <input type="radio" name="import-mode" value="meal_ideas" checked={importMode === 'meal_ideas'} onChange={() => setImportMode('meal_ideas')} className="sr-only" />
                                        <div className="font-semibold text-gray-800 text-sm">Meal Ideas</div>
                                        <div className="text-[10px] text-gray-500">AI generates full healthy recipes.</div>
                                    </label>
                                </div>
                                <style>{`
                                    label[data-active='true'] { border-color: #3b82f6; background-color: #eff6ff; }
                                `}</style>
                            </div>

                             <div className="p-3 bg-blue-50 border border-blue-100 rounded-md text-xs text-blue-700 mb-4">
                                <strong>Smart Import:</strong> AI will automatically scale all recipes to match your family size and health goals during processing.
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
                                    accept=".txt,.md,.pdf"
                                />
                                <div className="mx-auto h-12 w-12 text-gray-400">
                                    <UploadIcon />
                                </div>
                                <p className="mt-2 text-sm text-gray-600">
                                    {file ? (
                                        <>Selected: <span className="font-semibold text-gray-800">{file.name}</span></>
                                    ) : (
                                        "Click to select PDF or Text file"
                                    )}
                                </p>
                            </div>
                        </>
                    )}
                    
                    {(status === 'processing' || status === 'error' || status === 'success') && (
                         <div className="mt-4 p-5 bg-gray-50 rounded-xl border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                                <p className="text-sm font-bold text-gray-800">
                                    {status === 'success' ? 'Import Complete' : (status === 'error' ? 'Import Failed' : 'Importing Recipes...')}
                                </p>
                                {status === 'processing' && estTimeRemaining !== null && (
                                    <span className="text-xs font-mono text-gray-500 bg-white px-2 py-1 rounded border">
                                        Est. {formatTime(estTimeRemaining)}
                                    </span>
                                )}
                            </div>

                            {/* Progress Bar Container */}
                            <div className="w-full bg-gray-200 rounded-full h-3 mb-3 overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-700 ease-out ${status === 'error' ? 'bg-red-500' : (status === 'success' ? 'bg-green-500' : 'bg-blue-600')}`}
                                    style={{ width: `${percentage}%` }}
                                >
                                    <div className="w-full h-full opacity-30 bg-gradient-to-r from-transparent via-white to-transparent animate-pulse"></div>
                                </div>
                            </div>

                            <div className="flex items-center text-sm text-gray-600">
                                {status === 'processing' && <LoadingIcon className="w-4 h-4 mr-2" />}
                                {status === 'success' && <CheckIcon className="w-4 h-4 mr-2 text-green-500" />}
                                <span>{progressMessage}</span>
                            </div>

                            {status === 'success' && (
                                <p className="text-xs text-green-700 font-semibold mt-2">
                                    Added {successCount} new recipes to your library.
                                </p>
                            )}

                            {status === 'processing' && (
                                <p className="text-[10px] text-gray-400 mt-4 italic text-center">
                                    Closing this window will cancel the import.
                                </p>
                            )}
                         </div>
                    )}
                </div>
                
                <div className="p-5 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3">
                    <button 
                        type="button" 
                        onClick={handleCancelClose} 
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        {status === 'success' ? 'Close' : 'Cancel'}
                    </button>
                    {status !== 'success' && status !== 'processing' && (
                        <button 
                            type="button" 
                            onClick={handleImport} 
                            disabled={!file} 
                            className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700 disabled:bg-blue-300 flex items-center"
                        >
                            <UploadIcon className="w-4 h-4 mr-2" />
                            <span>Start Import</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BulkImportModal;
