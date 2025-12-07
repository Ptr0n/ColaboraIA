
import React, { useState, useCallback, useRef } from 'react';
import { Configuration } from '../types';
import { DocumentIcon, UsersIcon, ComputerIcon, WifiIcon, NoWifiIcon, UploadIcon, ScanIcon } from './icons/Icons';
import { extractStudentNames } from '../services/geminiService';

interface ConfigurationPanelProps {
    onGenerate: (config: Configuration) => void;
}

const PRESET_NAMES = [
    'Sofía', 'Mateo', 'Valentina', 'Santiago', 'Isabella', 'Sebastián', 'Camila', 'Matías',
    'Valeria', 'Alejandro', 'Mariana', 'Daniel', 'Gabriela', 'Diego', 'Luciana', 'Benjamín',
    'Martina', 'Nicolás', 'Mía', 'Samuel', 'Victoria', 'Joaquín', 'Emilia', 'Leonardo',
    'Renata', 'Lucas', 'Julieta', 'Emiliano', 'Regina', 'Thiago', 'Ximena', 'Iker', 'Romina',
    'Patricio', 'Andrea', 'Ricardo', 'Fernanda', 'Francisco', 'Abril', 'Eduardo'
];

const initialStudentList = [
    'Sofía García', 'Mateo Rodriguez', 'Valentina Martinez', 'Santiago Hernandez', 'Isabella Lopez',
    'Sebastián Perez', 'Camila Gonzalez', 'Matías Sanchez', 'Valeria Ramirez', 'Alejandro Flores',
    'Mariana Jimenez', 'Daniel Gomez', 'Gabriela Cruz', 'Diego Ortiz', 'Luciana Moreno'
].join('\n');


const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({ onGenerate }) => {
    const [studentNames, setStudentNames] = useState<string>(initialStudentList);
    const [computerCount, setComputerCount] = useState<number>(8);
    const [connectivity, setConnectivity] = useState<'online' | 'offline'>('online');
    const [classPlanFile, setClassPlanFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isExtractingNames, setIsExtractingNames] = useState<boolean>(false);
    
    const studentCount = studentNames.split('\n').filter(name => name.trim() !== '').length;

    const handleGenerateRandom = () => {
        const randomCount = Math.floor(Math.random() * (25 - 15 + 1)) + 15; // Random between 15-25
        const shuffled = [...PRESET_NAMES].sort(() => 0.5 - Math.random());
        const lastNames = ['García', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Perez', 'Gonzalez', 'Sanchez'];
        const selected = Array.from({ length: randomCount }, (_, i) => {
            const firstName = shuffled[i % shuffled.length];
            const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
            return `${firstName} ${lastName}`;
        }).join('\n');
        setStudentNames(selected);
    };

    const readFileAsBase64 = (file: File): Promise<{ mimeType: string; data: string }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // result is a data URL like "data:application/pdf;base64,..."
                const parts = result.split(',');
                if (parts.length !== 2) {
                    return reject(new Error("Invalid file format for base64 encoding."));
                }
                const mimeType = parts[0].split(':')[1].split(';')[0];
                const data = parts[1];
                resolve({ mimeType, data });
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setClassPlanFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleStudentListUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setIsExtractingNames(true);
            setError(null);
            
            try {
                const fileData = await readFileAsBase64(file);
                const extractedNames = await extractStudentNames(fileData);
                
                if (extractedNames.length > 0) {
                    setStudentNames(extractedNames.join('\n'));
                } else {
                    setError('No se encontraron nombres legibles en el archivo.');
                }
            } catch (err) {
                console.error(err);
                setError('Error al procesar el archivo de lista de estudiantes.');
            } finally {
                setIsExtractingNames(false);
                // Reset file input value to allow re-uploading the same file if needed
                e.target.value = '';
            }
        }
    };

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        
        const names = studentNames.split('\n').filter(name => name.trim() !== '');

        if (names.length < 2) {
             setError('Debe haber al menos 2 estudiantes.');
            return;
        }
        if (computerCount < 1) {
            setError('Debe haber al menos 1 computador.');
            return;
        }
        if (!classPlanFile) {
            setError('Por favor, sube un archivo con el plan de clase.');
            return;
        }
        setError(null);

        try {
            const classPlan = await readFileAsBase64(classPlanFile);
            onGenerate({ studentCount: names.length, computerCount, connectivity, classPlan, studentNames: names });
        } catch (err) {
            setError('Error al leer el archivo. Asegúrate de que es un archivo válido.');
            console.error("File read error:", err);
        }

    }, [studentNames, computerCount, connectivity, classPlanFile, onGenerate]);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Crea tu Estrategia Colaborativa</h2>
                <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
                    Sube tu plan de clase y deja que la IA organice los grupos y roles por ti.
                </p>
            </div>
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                     <div className="md:col-span-1">
                        <label htmlFor="computerCount" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            <ComputerIcon /> Computadores Disponibles
                        </label>
                        <input
                            type="number"
                            id="computerCount"
                            value={computerCount}
                            onChange={(e) => setComputerCount(parseInt(e.target.value, 10))}
                            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                            min="1"
                        />
                    </div>
                    <div className="md:col-span-1">
                        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {connectivity === 'online' ? <WifiIcon /> : <NoWifiIcon />} Conectividad
                        </label>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1 rounded-md">
                            <button type="button" onClick={() => setConnectivity('online')} className={`w-1/2 py-1.5 text-sm rounded ${connectivity === 'online' ? 'bg-sky-500 text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>Online</button>
                            <button type="button" onClick={() => setConnectivity('offline')} className={`w-1/2 py-1.5 text-sm rounded ${connectivity === 'offline' ? 'bg-slate-500 text-white shadow' : 'text-slate-600 dark:text-slate-300'}`}>Offline</button>
                        </div>
                    </div>
                    <div className="md:col-span-3">
                        <div className="flex justify-between items-end mb-2">
                            <label htmlFor="studentNames" className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                                <UsersIcon /> Lista de Estudiantes
                            </label>
                            <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${isExtractingNames ? 'bg-slate-200 dark:bg-slate-600 text-slate-500 cursor-wait' : 'text-sky-600 dark:text-sky-400 bg-sky-100 dark:bg-sky-900/50 hover:bg-sky-200 dark:hover:bg-sky-900'}`}>
                                <ScanIcon size="w-3.5 h-3.5" />
                                <span>{isExtractingNames ? 'Analizando...' : 'Cargar lista desde Imagen/Doc'}</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                                    onChange={handleStudentListUpload}
                                    disabled={isExtractingNames}
                                />
                            </label>
                        </div>
                         <textarea
                            id="studentNames"
                            rows={8}
                            value={studentNames}
                            onChange={(e) => setStudentNames(e.target.value)}
                            disabled={isExtractingNames}
                            className={`w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-sm ${isExtractingNames ? 'opacity-50' : ''}`}
                            placeholder="Un nombre por línea..."
                        />
                        <div className="flex justify-between items-center mt-2">
                            <p className="text-sm text-slate-500 dark:text-slate-400">Total: <span className="font-semibold">{studentCount}</span> estudiantes</p>
                            <button type="button" onClick={handleGenerateRandom} className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
                                Generar Aleatorios
                            </button>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        <DocumentIcon /> Plan de Clase
                    </label>
                    <div className="mt-2 flex justify-center rounded-lg border border-dashed border-slate-900/25 dark:border-slate-100/25 px-6 py-10 bg-slate-50 dark:bg-slate-800/20">
                        <div className="text-center">
                            {classPlanFile ? (
                                <>
                                    <DocumentIcon />
                                    <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                                        Archivo: <span className="font-semibold text-sky-600 dark:text-sky-400">{classPlanFile.name}</span>
                                    </p>
                                    <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-sky-600 dark:text-sky-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-600 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-800 hover:text-sky-500">
                                        <span>Cambiar archivo</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
                                    </label>
                                </>
                            ) : (
                                <>
                                    <UploadIcon />
                                    <div className="mt-4 flex text-sm leading-6 text-slate-600 dark:text-slate-400">
                                        <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-sky-600 dark:text-sky-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-600 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-800 hover:text-sky-500">
                                            <span>Sube un archivo</span>
                                            <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
                                        </label>
                                        <p className="pl-1">o arrástralo aquí</p>
                                    </div>
                                    <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">PDF, DOC, DOCX</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}

                <div className="mt-8 text-center">
                    <button
                        type="submit"
                        disabled={isExtractingNames}
                        className="w-full md:w-auto px-12 py-3 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-800 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Generar Estrategia
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ConfigurationPanel;
