import React, { useState, useEffect } from 'react';
import { Strategy } from '../types';
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
    onSave: (updatedStrategy: Strategy) => void;
}

// --- CONSTANTS & HELPERS (Fuera del componente para evitar recreación) ---

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
    const normalizedRole = roleName ? roleName.toLowerCase() : '';
    const matchKey = Object.keys(roleIcons).find(key => normalizedRole.includes(key));
    const IconComponent = matchKey ? roleIcons[matchKey] : DefaultRoleIcon;
    return <IconComponent size={size} />;
};

// Función para clonar profundamente de forma segura
const deepClone = <T,>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
};

// Lógica pura de negocio: Recalcular roles y limpiar sobrantes
const processStrategyLogic = (strat: Strategy): Strategy => {
    const groups = strat.strategy.groupDistribution.groups;
    let roles = strat.strategy.collaborativeRoles;

    // 1. Encontrar tamaño máximo actual de grupo
    let maxGroupSize = 0;
    groups.forEach(group => {
        if (group.students.length > maxGroupSize) {
            maxGroupSize = group.students.length;
        }
    });

    // 2. Si el grupo más grande es 0, no hacemos nada
    if (maxGroupSize === 0) return strat;

    // 3. Si hay roles sobrantes, recortamos la lista de definiciones
    if (roles.length > maxGroupSize) {
        roles = roles.slice(0, maxGroupSize);
        strat.strategy.collaborativeRoles = roles;
    }

    // 4. Reasignar roles a cada estudiante según su nueva posición (índice)
    groups.forEach(group => {
        group.students.forEach((student, index) => {
            if (index < roles.length) {
                student.role = roles[index].roleName;
            } else {
                student.role = `Rol Auxiliar ${index + 1}`;
            }
        });
    });

    return strat;
};

// Helper para obtener clase de color
const getRoleColorClass = (roleName: string, colorSet: { [key: string]: string }, currentStrat: Strategy) => {
    const roleIndex = currentStrat.strategy.collaborativeRoles.findIndex(r => r.roleName === roleName);
    const colorKey = roleIndex !== -1 ? ((roleIndex) % (Object.keys(colorSet).length - 1) + 1).toString() : 'default';
    return colorSet[colorKey] || colorSet.default;
};

// --- MAIN COMPONENT ---

const StrategyDisplay: React.FC<StrategyDisplayProps> = ({ strategy, onSave }) => {
    // Estado temporal para edición. Si es null, no estamos editando.
    const [tempStrategy, setTempStrategy] = useState<Strategy | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    
    // Determinamos si estamos en modo edición basado en la existencia de tempStrategy
    const isEditing = tempStrategy !== null;

    // --- Actions ---

    const startEditing = () => {
        // Clonar profudamente la estrategia original para no mutarla
        const editableCopy = processStrategyLogic(deepClone(strategy));
        setTempStrategy(editableCopy);
    };

    const cancelEditing = () => {
        setTempStrategy(null);
    };

    const saveChanges = () => {
        if (!tempStrategy) return;

        if (window.confirm("¿Guardar los cambios realizados en los grupos?")) {
            // 1. Clonar una última vez para asegurar que enviamos un objeto limpio
            const finalStrategy = deepClone(tempStrategy);
            
            // 2. Enviar al padre
            onSave(finalStrategy);
            
            // 3. Cerrar edición (IMPORTANTE: Esto debe suceder después de onSave)
            setTempStrategy(null);
        }
    };

    // --- Data Modifications (CRUD) ---

    const handleDeleteStudent = (groupIndex: number, studentIndex: number) => {
        if (!tempStrategy) return;
        
        if (window.confirm("¿Eliminar este estudiante?")) {
            setTempStrategy(prevStrat => {
                if (!prevStrat) return null;
                const newStrat = deepClone(prevStrat);
                
                // Borrar
                newStrat.strategy.groupDistribution.groups[groupIndex].students.splice(studentIndex, 1);
                
                // Recalcular roles y limpiar
                return processStrategyLogic(newStrat);
            });
        }
    };

    const handleDropOnGroup = (e: React.DragEvent, targetGroupIndex: number) => {
        if (!tempStrategy) return;
        e.preventDefault();
        e.stopPropagation();

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { sourceGroupIndex, studentIndex } = data;

            setTempStrategy(prevStrat => {
                if (!prevStrat) return null;
                const newStrat = deepClone(prevStrat);
                const groups = newStrat.strategy.groupDistribution.groups;

                // Extraer
                const [movedStudent] = groups[sourceGroupIndex].students.splice(studentIndex, 1);
                
                // Insertar al final del grupo destino
                groups[targetGroupIndex].students.push(movedStudent);

                return processStrategyLogic(newStrat);
            });

        } catch (error) {
            console.error("Drop Error:", error);
        }
    };

    const handleDropOnStudent = (e: React.DragEvent, targetGroupIndex: number, targetStudentIndex: number) => {
        if (!tempStrategy) return;
        e.preventDefault();
        e.stopPropagation();

        try {
            const data = JSON.parse(e.dataTransfer.getData('application/json'));
            const { sourceGroupIndex, studentIndex: sourceStudentIndex } = data;

            setTempStrategy(prevStrat => {
                if (!prevStrat) return null;
                const newStrat = deepClone(prevStrat);
                const groups = newStrat.strategy.groupDistribution.groups;

                // 1. Extraer estudiante
                const [movedStudent] = groups[sourceGroupIndex].students.splice(sourceStudentIndex, 1);
                
                // 2. Calcular índice real de inserción
                let insertIndex = targetStudentIndex;
                
                // Insertar
                groups[targetGroupIndex].students.splice(insertIndex, 0, movedStudent);

                return processStrategyLogic(newStrat);
            });

        } catch (error) {
            console.error("Drop Student Error:", error);
        }
    };

    // --- Drag Helpers ---

    const handleDragStart = (e: React.DragEvent, sourceGroupIndex: number, studentIndex: number) => {
        e.dataTransfer.setData('application/json', JSON.stringify({ sourceGroupIndex, studentIndex }));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!isEditing) return;
        e.preventDefault(); 
        e.dataTransfer.dropEffect = 'move';
    };

    // --- PDF Export ---

    const handleExportPDF = async () => {
        setIsExporting(true);
        const wasEditing = isEditing;
        if (wasEditing) setTempStrategy(null); // Ocultar UI de edición para el PDF

        setTimeout(async () => {
            const content = document.getElementById('strategy-content');
            if (!content) {
                setIsExporting(false);
                if (wasEditing) startEditing();
                return;
            }

            const isDarkMode = document.documentElement.classList.contains('dark');
            if (isDarkMode) document.documentElement.classList.remove('dark');

            try {
                const canvas = await html2canvas(content, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#f8fafc' 
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
                console.error("PDF Error:", error);
            } finally {
                if (isDarkMode) document.documentElement.classList.add('dark');
                setIsExporting(false);
                if (wasEditing) {
                    alert("Exportación completada. Se ha restaurado el modo normal.");
                }
            }
        }, 100);
    };

    // --- Render ---

    // La estrategia a mostrar es tempStrategy (si editamos) o strategy (props)
    const activeStrategy = tempStrategy || strategy;
    const activeGroups = activeStrategy.strategy.groupDistribution.groups;
    const activeRoles = activeStrategy.strategy.collaborativeRoles;
    const { analysis, evaluationTools } = activeStrategy;

    return (
        <div className="space-y-8 animate-fade-in">
             <div id="strategy-content" className="p-1">
                {/* Header Actions */}
                <section>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                        <h2 className="text-2xl font-bold">📊 Análisis del Plan de Clase</h2>
                        <div className="flex gap-2">
                             {!isEditing ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={startEditing}
                                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm font-semibold"
                                    >
                                        <EditIcon /> Editar Grupos
                                    </button>
                                    <button
                                        type="button"
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
                                        type="button"
                                        onClick={cancelEditing}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-500 text-white rounded-lg hover:bg-slate-600 transition-colors text-sm font-semibold"
                                    >
                                        <CancelIcon /> Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        onClick={saveChanges}
                                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-semibold"
                                    >
                                        <SaveIcon /> Guardar Cambios
                                    </button>
                                 </>
                             )}
                        </div>
                    </div>
                    {/* Content */}
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
                <section className="mt-8">
                    <h2 className="text-2xl font-bold mb-4">🚀 Estrategia Colaborativa</h2>
                    {isEditing && (
                        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                             <EditIcon size="w-4 h-4"/>
                             <span><strong>Modo Edición:</strong> Arrastra estudiantes para cambiar su orden (y su rol) o moverlos de grupo. Los roles se actualizan automáticamente según la posición.</span>
                        </div>
                    )}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Group Distribution */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold mb-4">👥 Distribución de Grupos ({activeGroups.length})</h3>
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
                                        onDrop={(e) => handleDropOnGroup(e, gIndex)}
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
                                                    key={`${gIndex}-${sIndex}-${student.name}`} 
                                                    className={`flex items-center justify-between text-sm p-1.5 rounded bg-white dark:bg-slate-800 shadow-sm ${
                                                        isEditing ? 'cursor-grab active:cursor-grabbing hover:shadow-md border border-transparent hover:border-sky-300' : ''
                                                    }`}
                                                    draggable={isEditing}
                                                    onDragStart={(e) => handleDragStart(e, gIndex, sIndex)}
                                                    onDragOver={handleDragOver}
                                                    onDrop={(e) => handleDropOnStudent(e, gIndex, sIndex)}
                                                >
                                                    <div className="flex items-center gap-2 pointer-events-none">
                                                        {isEditing && <div className="text-slate-400"><GripIcon size="w-4 h-4"/></div>}
                                                        <span className="text-slate-700 dark:text-slate-200 font-medium">{student.name}</span>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${getRoleColorClass(student.role, roleTagColors, activeStrategy)} pointer-events-none`}>
                                                            <RoleIcon roleName={student.role} size="w-3 h-3"/>
                                                            <span className="max-w-[80px] truncate">{student.role}</span>
                                                        </span>
                                                        {isEditing && (
                                                            <button 
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteStudent(gIndex, sIndex);
                                                                }}
                                                                className="text-red-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
                                                                title="Eliminar estudiante"
                                                            >
                                                                <TrashIcon size="w-4 h-4"/>
                                                            </button>
                                                        )}
                                                    </div>
                                                </li>
                                            ))}
                                            {isEditing && group.students.length === 0 && (
                                                <li className="text-xs text-slate-400 text-center italic py-2">Arrastra estudiantes aquí</li>
                                            )}
                                        </ul>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Collaborative Roles (Sidebar) */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 row-span-2">
                            <h3 className="text-xl font-semibold mb-4">🎭 Roles Colaborativos</h3>
                            <div className="space-y-4">
                                {activeRoles.map((role, i) => (
                                    <div key={i} className={`p-4 rounded-lg border-l-4 ${getRoleColorClass(role.roleName, roleColors, activeStrategy)}`}>
                                        <h4 className="font-bold flex items-center gap-2">
                                            <span className="text-xs font-mono opacity-50">#{i + 1}</span>
                                            <RoleIcon roleName={role.roleName} size="w-6 h-6" />
                                            <span>{role.roleName}</span>
                                        </h4>
                                        <p className="text-sm italic my-1">{role.description}</p>
                                        <ul className="list-disc list-inside text-sm space-y-0.5 mt-2">
                                            {role.responsibilities.map((resp, j) => <li key={j}>{resp}</li>)}
                                        </ul>
                                    </div>
                                ))}
                                {activeRoles.length === 0 && (
                                    <p className="text-sm text-slate-500 italic">No hay roles definidos.</p>
                                )}
                            </div>
                        </div>
                        
                        {/* Extras */}
                         <div className="space-y-8">
                            {activeStrategy.strategy.mitigationStrategies && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-xl font-semibold mb-2">🤔 Estrategias de Mitigación</h3>
                                    <p className="text-slate-600 dark:text-slate-300">{activeStrategy.strategy.mitigationStrategies}</p>
                                </div>
                            )}
                            {activeStrategy.strategy.offlineResources && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                                    <h3 className="text-xl font-semibold mb-2">🔌 Recursos Offline</h3>
                                    <p className="text-slate-600 dark:text-slate-300">{activeStrategy.strategy.offlineResources}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
                
                {/* Evaluation Tools Section */}
                <section className="mt-8">
                    <h2 className="text-2xl font-bold mb-4">📋 Herramientas de Evaluación</h2>
                    <div className="space-y-8">
                        {/* Rubric */}
                        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md border border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-semibold mb-4">Rúbrica de Evaluación por Roles</h3>
                            <div className="space-y-6">
                                {evaluationTools.rubric
                                    .filter(item => activeRoles.some(r => r.roleName === item.role)) 
                                    .map((item, i) => (
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