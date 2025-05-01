import React, {useRef} from 'react';
import { Paperclip } from 'lucide-react';

interface PdfButtonProps {
    pdfFile: File | null;
    setPdfFile: React.Dispatch<React.SetStateAction<File | null>>;
}

const PdfButton: React.FC<PdfButtonProps> = ({pdfFile, setPdfFile}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    console.log(pdfFile)

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] || null;
        setPdfFile(file);
    };

    const handlePdfUpload = () => {
        console.log("Upload PDF clicked");
        fileInputRef.current?.click();
    }

    return (
        <>
            <button
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Add attachment"
                onClick={handlePdfUpload}
            >
                <Paperclip size={20} />
            </button>
            <input  
                type="file"
                accept="application/pdf"
                ref={fileInputRef}
                onChange={handleFileChange}
                style={{ display: 'none' }}
            />
        </>
    ) 
}

export default PdfButton;