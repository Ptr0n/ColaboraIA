
import React, { useState, useEffect, useRef } from 'react';
import { Strategy, Group } from '../types';
import { 
    ComputerIcon,
    PdfIcon,
    LeaderIcon,
    SecretaryIcon,
    SpokespersonIcon,
    TimekeeperIcon,
    ResearcherIcon,
    DefaultRoleIcon,
    EditIcon,
    SaveIcon,
    CancelIcon,
    TrashIcon,
    GripIcon
} from './icons/Icons';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface StrategyDisplayProps {
    strategy: Strategy;
}

const StrategyDisplay: React.FC<StrategyDisplayProps> = ({ strategy }) => {
    // Local state for the strategy to support editing without affecting the original prop immediately
    const [currentStrategy, setCurrentStrategy] = useState<Strategy>(strategy);
    const [isEditing, setIsEditing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
    
    // Sync if the parent strategy prop changes significantly (e.g. regeneration)
    // We only reset if the analysis topic changes to avoid overwriting edits on minor parent renders
    useEffect(() => {
        if (strategy.analysis.topic !== currentStrategy.analysis.topic) {
            setCurrentStrategy(strategy);
            setIsEditing(false);
        }
    }, [strategy, currentStrategy.analysis.topic]);

    const { analysis, strategy: strategyDetails, evaluationTools } = currentStrategy;

    const roleColors: { [key: string]: string } = {
        default: 'bg-sky-100 dark:bg-sky-900/50 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-700',
        1: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700',
        2: 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        3: 'bg-violet-100 dark:bg-violet-900/50 text-violet-800 dark:text-violet-300 border-violet-300 dark:border-violet-700',
        4: 'bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700',
    };

    const roleTagColors: { [key: string]: string } = {
        default: 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200',
        1: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200',
        2: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200',
        3: 'bg-violet-100 dark:bg-violet-900 text-violet-800 dark:text-violet-200',
        4: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-200',
    };

    const getRoleColorClass = (roleName: string, colorSet: { [key: string]: string }) => {
        const roleIndex = strategyDetails.collaborativeRoles.findIndex(r => r.roleName === roleName);
        const colorKey = roleIndex !== -1 ? ((roleIndex) % (Object.keys(colorSet).length -1) + 1).toString() : 'default';
        return colorSet[colorKey] || colorSet.default;
    };

    const roleIcons: { [key: string]: React.FC<{ size?: string }> } = {
        'líder': LeaderIcon,
        'secretario': SecretaryIcon,
        'portavoz': SpokespersonIcon,
        'controlador de tiempo': TimekeeperIcon,
        'investigador': ResearcherIcon,
        'organizador': LeaderIcon,
        'escriba': SecretaryIcon,
        'presentador': SpokespersonIcon,
        'gestor del tiempo': TimekeeperIcon
    };
    
    const RoleIcon: React.FC<{ roleName: string; size?: string }> = ({ roleName, size }) => {
        const normalizedRole = roleName.toLowerCase();
        const IconComponent = Object.keys(roleIcons).find(key => normalizedRole.includes(key))
            ? roleIcons[Object.keys(roleIcons).find(key => normalizedRole.includes(key))!]
            : DefaultRoleIcon;
        return <IconComponent size={size} />;
    };

    // --- Drag and Drop & Edit Logic ---

    // Temporary state to hold changes while editing before saving
    const [tempStrategy, setTempStrategy] = useState<Strategy | null>(null);

    const startEditing = () => {
        setTempStrategy(JSON.parse(JSON.stringify(currentStrategy))); // Deep copy
        setIsEditing(true);
    };

    const cancelEditing = () => {
        setTempStrategy(null);
        setIsEditing(false);
    };

    const requestSave = () => {
        setShowSaveConfirmation(true);
    };

    const confirmSave = () => {
        if (tempStrategy) {
            setCurrentStrategy(tempStrategy);
        }
        setIsEditing(false);
        setTempStrategy(null);
        setShowSaveConfirmation(false);
    };

    const cancelSaveModal = () => {
        setShowSaveConfirmation(false);
    };

    const handleDragStart = (e: React.DragEvent, sourceGroupIndex: number, studentIndex: number) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ sourceGroupIndex, studentIndex }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!isEditing) return;
        e.preventDefault(); // Necessary to allow dropping
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetGroupIndex: number) => {
        if (!isEditing || !tempStrategy) return;
        e.preventDefault();

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { sourceGroupIndex, studentIndex } = data;

            if (sourceGroupIndex === targetGroupIndex) return;

            const newStrategy = { ...tempStrategy };
            const groups = newStrategy.strategy.groupDistribution.groups;

            // Remove from source
            const [movedStudent] = groups[sourceGroupIndex].students.splice(studentIndex, 1);
            
            // Add to target
            groups[targetGroupIndex].students.push(movedStudent);

            setTempStrategy(newStrategy);

        } catch (error) {
            console.error("Error dropping item:", error);
        }
    };

    const handleDeleteStudent = (groupIndex: number, studentIndex: number) => {
        if (!isEditing || !tempStrategy) return;
        
        const newStrategy = { ...tempStrategy };
        newStrategy.strategy.groupDistribution.groups[groupIndex].students.splice(studentIndex, 1);
        setTempStrategy(newStrategy);
    };

    // --- Export Logic ---

    const handleExportPDF = async () => {
        setIsExporting(true);
        // Temporarily disable editing mode for clean export if active
        const wasEditing = isEditing;
        if (wasEditing) setIsEditing(false);

        // Wait a tick for render update
        setTimeout(async () => {
            const content = document.getElementById('strategy-content');
            if (!content) {
                setIsExporting(false);
                if (wasEditing) setIsEditing(true);
                return;
            }

            const isDarkMode = document.documentElement.classList.contains('dark');
            if (isDarkMode) {
                document.documentElement.classList.remove('dark');
            }

            try {
                const canvas = await html2canvas(content, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#f8fafc' // Light mode background
                });

                const imgData = canvas.toDataURL('image/png');
                const pdf = new jsPDF({
                    orientation: 'portrait',
                    unit: 'px',
                    format: [canvas.width, canvas.height]
                });

                pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
                pdf.save('Estrategia_ColaboraIA.pdf');
            } catch (error) {
                console.error("Error exporting to PDF:", error);
            } finally {
                if (isDarkMode) {
                    document.documentElement.classList.add('dark');
                }
                setIsExporting(false);
                if (wasEditing) setIsEditing(true);
            }
        }, 100);
    };

    // Determine which strategy to display (edited or saved)
    const activeStrategy = isEditing && tempStrategy ? tempStrategy : currentStrategy;
    const activeGroups = activeStrategy.strategy.groupDistribution.groups;

    return (
        <div className="space-y-8 animate-fade-in relative">
            {/* Save Confirmation Modal */}
            {showSaveConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Confirmar Cambios</h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">¿Estás seguro de que deseas guardar la nueva distribución de grupos?</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={cancelSaveModal} 
                                className="px-4 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-medium text-sm transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={confirmSave} 
                                className="px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium text-sm shadow-sm transition-colors"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

             <div id="strategy-content" className="p-1"> {/* Padding to prevent content cutting */}
                {/* Analysis Section */}
                <section>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <h2 className="text-2xl font-bold">📊 Análisis del Plan de Clase</h2>
                        <div className="flex gap-2">
                             {!isEditing ? (
                                <>
                                    <button
                                        onClick={startEditing}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-semibold"
                                    >
                                        <EditIcon /> Editar Grupos
                                    </button>
                                    <button
                                        onClick={handleExportPDF}
                                        disabled={isExporting}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-600 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors text-sm font-semibold disabled:opacity-50"
                                    >
                                        <PdfIcon />
                                        {isExporting ? 'Exportando...' : 'Exportar a PDF'}
                                    </button>
                                </>
                             ) : (
                                 <>
                                    <button
                                        onClick={cancelEditing}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-semibold"
                                    >
                                        <CancelIcon /> Cancelar
                                    </button>
                                    <button
                                        onClick={requestSave}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
                                    >
                                        <SaveIcon /> Guardar Cambios
                                    </button>
                                 </>
                             )}
                        </div>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                        <h3 className="text-xl font-semibold text-sky-600 dark:text-sky-400">{analysis.topic}</h3>
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold mb-2">🎯 Objetivos Pedagógicos</h4>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                    {analysis.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                                </ul>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">🛠️ Competencias a Desarrollar</h4>
                                <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300">
                                    {analysis.competencies.map((comp, i) => <li key={i}>{comp}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Strategy Section */}
                <section>
                    <h2 className="text-2xl font-bold mb-4">🚀 Estrategia Colaborativa</h2>
                    {isEditing && (
                        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                             <EditIcon size="w-4 h-4"/>
                             <span>Estás en <strong>modo edición</strong>. Arrastra los estudiantes para reorganizar los grupos o usa la papelera para eliminarlos. Recuerda guardar los cambios.</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Group Distribution */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold mb-4">👥 Distribución de Grupos ({strategyDetails.groupDistribution.totalGroups})</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {activeGroups.map((group, gIndex) => (
                                    <div 
                                        key={group.groupNumber} 
                                        className={`p-4 rounded-md flex flex-col transition-colors ${
                                            isEditing 
                                                ? 'bg-slate-100 dark:bg-slate-700 border-2 border-dashed border-slate-300 dark:border-slate-500 hover:border-sky-400 dark:hover:border-sky-500' 
                                                : 'bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600'
                                        }`}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, gIndex)}
                                    >
                                        <div className="flex justify-between items-baseline mb-3 pointer-events-none">
                                            <h4 className="font-bold text-slate-800 dark:text-slate-100">Grupo {group.groupNumber}</h4>
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                                <ComputerIcon /><span>PC {group.computer}</span>
                                            </div>
                                        </div>
                                        <ul className="space-y-2 min-h-[50px]">
                                            {group.students.map((student, sIndex) => (
                                                <li 
                                                    key={sIndex} 
                                                    className={`flex items-center justify-between text-sm p-1.5 rounded bg-white dark:bg-slate-800 shadow-sm ${
                                                        isEditing ? 'cursor-grab active:cursor-grabbing hover:shadow-md' : ''
                                                    }`}
                                                    draggable={isEditing}
                                                    onDragStart={(e) => handleDragStart(e, gIndex, sIndex)}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        {isEditing && <div className="text-slate-400"><GripIcon size="w-4 h-4"/></div>}
                                                        <span className="text-slate-700 dark:text-slate-200 font-medium">{student.name}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getRoleColorClass(student.role, roleTagColors)}`}>
                                                            <RoleIcon roleName={student.role} size="w-3 h-3"/>
                                                            <span className="max-w-[80px] truncate">{student.role}</span>
                                                        </span>
                                                        {isEditing && (
                                                            <button 
                                                                onClick={() => handleDeleteStudent(gIndex, sIndex)}
                                                                className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
                                                                title="Eliminar estudiante"
                                                            >
                                                                <TrashIcon size="w-4 h-4"/>
                                                            </button>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                            {group.students.length === 0 && (
                                                <li className="text-xs text-slate-400 text-center italic py-2">Grupo vacío</li>
                                            )}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Collaborative Roles */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 row-span-2">
                            <h3 className="text-xl font-semibold mb-4">🎭 Roles Colaborativos</h3>
                            <div className="space-y-4">
                                {strategyDetails.collaborativeRoles.map((role, i) => (
                                    <div key={i} className={`p-4 rounded-lg border-l-4 ${getRoleColorClass(role.roleName, roleColors)}`}>
                                        <h4 className="font-bold flex items-center gap-2">
                                            <RoleIcon roleName={role.roleName} size="w-6 h-6" />
                                            <span>{role.roleName}</span>
                                        </h4>
                                        <p className="text-sm italic my-1">{role.description}</p>
                                        <ul className="list-disc list-inside text-sm space-y-0.5 mt-2">
                                            {role.responsibilities.map((resp, j) => <li key={j}>{resp}</li>)}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* Mitigation & Resources */}
                         <div className="space-y-8">
                            {strategyDetails.mitigationStrategies && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-xl font-semibold mb-2">🤔 Estrategias de Mitigación</h3>
                                    <p className="text-slate-600 dark:text-slate-300">{strategyDetails.mitigationStrategies}</p>
                                </div>
                            )}
                            {strategyDetails.offlineResources && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-xl font-semibold mb-2">🔌 Recursos Offline</h3>
                                    <p className="text-slate-600 dark:text-slate-300">{strategyDetails.offlineResources}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
                
                {/* Evaluation Tools Section */}
                <section>
                    <h2 className="text-2xl font-bold mb-4">📋 Herramientas de Evaluación</h2>
                    <div className="space-y-8">
                        {/* Rubric */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold mb-4">Rúbrica de Evaluación por Roles</h3>
                            <div className="space-y-6">
                                {evaluationTools.rubric.map((item, i) => (
                                    <div key={i}>
                                        <h4 className="font-semibold text-lg text-sky-700 dark:text-sky-400 mb-2 flex items-center gap-2">
                                            <RoleIcon roleName={item.role} size="w-5 h-5"/>
                                            {item.role}
                                        </h4>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                                    <tr>
                                                        {item.criteria.map((c, j) => <th key={j} className="p-2 font-medium">{c.level}</th>)}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr className="border-t border-slate-200 dark:border-slate-600">
                                                        {item.criteria.map((c, j) => <td key={j} className="p-2 align-top">{c.description}</td>)}
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold mb-4">Lista de Cotejo Grupal</h3>
                            <ul className="space-y-3">
                                {evaluationTools.checklist.map((item, i) => (
                                    <li key={i} className="flex items-start">
                                        <div className="w-5 h-5 border-2 border-slate-400 dark:border-slate-500 rounded-sm mt-1 mr-3 flex-shrink-0"></div>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    );
};

export default StrategyDisplay;
