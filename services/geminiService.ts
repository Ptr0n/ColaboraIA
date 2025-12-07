
import { GoogleGenAI, Type } from "@google/genai";
import { Configuration, Strategy } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const strategySchema = {
    type: Type.OBJECT,
    properties: {
        analysis: {
            type: Type.OBJECT,
            properties: {
                topic: { type: Type.STRING, description: "Tema central del plan de clase." },
                objectives: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Objetivos pedagógicos principales." },
                competencies: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Competencias a desarrollar." },
            },
            required: ["topic", "objectives", "competencies"]
        },
        strategy: {
            type: Type.OBJECT,
            properties: {
                groupDistribution: {
                    type: Type.OBJECT,
                    properties: {
                        totalGroups: { type: Type.INTEGER, description: "Número total de grupos." },
                        groups: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    groupNumber: { type: Type.INTEGER },
                                    students: {
                                        type: Type.ARRAY,
                                        items: {
                                            type: Type.OBJECT,
                                            properties: {
                                                name: { type: Type.STRING, description: "Nombre del estudiante." },
                                                role: { type: Type.STRING, description: "Rol asignado al estudiante, debe coincidir con uno de los roles definidos." }
                                            },
                                            required: ["name", "role"]
                                        }
                                    },
                                    computer: { type: Type.INTEGER }
                                },
                                required: ["groupNumber", "students", "computer"]
                            }
                        }
                    },
                    required: ["totalGroups", "groups"]
                },
                collaborativeRoles: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            roleName: { type: Type.STRING, description: "Nombre del rol." },
                            description: { type: Type.STRING, description: "Descripción de la función del rol." },
                            responsibilities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Responsabilidades clave del rol." }
                        },
                        required: ["roleName", "description", "responsibilities"]
                    }
                },
                mitigationStrategies: { type: Type.STRING, description: "Estrategias si el grupo supera los 3 estudiantes por computador. (Opcional)" },
                offlineResources: { type: Type.STRING, description: "Recursos y materiales offline sugeridos. (Opcional, si la conectividad es 'offline')" },
            },
            required: ["groupDistribution", "collaborativeRoles"]
        },
        evaluationTools: {
            type: Type.OBJECT,
            properties: {
                rubric: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            role: { type: Type.STRING, description: "Rol a evaluar." },
                            criteria: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        level: { type: Type.STRING, description: "Nivel de desempeño (e.g., Excelente)." },
                                        description: { type: Type.STRING, description: "Descripción del criterio para ese nivel." }
                                    },
                                    required: ["level", "description"]
                                }
                            }
                        },
                        required: ["role", "criteria"]
                    }
                },
                checklist: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista de cotejo grupal o individual." }
            },
            required: ["rubric", "checklist"]
        }
    },
    required: ["analysis", "strategy", "evaluationTools"]
};

export const generateStrategy = async (config: Configuration): Promise<Strategy> => {
    const studentList = config.studentNames.join(', ');
    const promptText = `
    Eres ColaboraIA, un agente experto en aprendizaje colaborativo para aulas de informática en educación media. Tu función es analizar el plan de clase adjunto y generar una estrategia colaborativa completa basada en el contexto del aula y la lista de estudiantes proporcionada.

    CONTEXTO:
    - Cantidad de Estudiantes: ${config.studentCount}
    - Lista de Estudiantes: ${studentList}
    - Número de Computadores: ${config.computerCount}
    - Estado de Conectividad: ${config.connectivity}

    TAREA:
    Basado en el contexto y el plan de clase adjunto, genera un objeto JSON que siga estrictamente el esquema proporcionado.
    1.  **Analiza** el plan de clase para determinar el tema central, los objetivos pedagógicos y las competencias a desarrollar.
    2.  **Calcula** la distribución óptima de grupos (mínimo 2, máximo 5 estudiantes por computador).
    3.  **Asigna** a CADA estudiante de la lista proporcionada a un grupo y a un computador.
    4.  **Define** un conjunto de roles colaborativos FIJOS y esenciales basados en la actividad del plan de clase.
    5.  **Asigna** los roles a los estudiantes siguiendo esta regla estricta: TODOS los grupos deben tener la misma composición de roles base. Por ejemplo, si el tamaño base del grupo es 3, y los roles son 'Líder', 'Secretario' y 'Portavoz', entonces TODOS los grupos deben tener un estudiante con cada uno de esos tres roles.
    6.  Si un grupo necesita tener más estudiantes que el tamaño base (porque el número total de estudiantes no es divisible de forma exacta), asigna un rol adicional o de apoyo (como 'Colaborador') a los estudiantes extra, **SOLO en esos grupos más grandes**. La estructura de roles principal debe permanecer consistente en todos los demás grupos.
    7.  **Proporciona** estrategias de mitigación si algún grupo supera los 3 estudiantes.
    8.  **Sugiere** recursos offline si la conectividad es 'offline'.
    9.  **Genera** instrumentos de evaluación: una rúbrica por roles y una lista de cotejo (checklist) para el grupo.
    `;

    const filePart = {
        inlineData: {
            mimeType: config.classPlan.mimeType,
            data: config.classPlan.data,
        },
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: promptText }, filePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: strategySchema,
                temperature: 0.5,
            },
        });

        const jsonString = response.text.trim();
        const parsedJson = JSON.parse(jsonString);
        return parsedJson as Strategy;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error && error.message.includes('SAFETY')) {
            throw new Error('La solicitud fue bloqueada por políticas de seguridad. Intenta reformular el plan de clase.');
        }
        throw new Error("No se pudo generar la estrategia. Por favor, revisa el plan de clase e inténtalo de nuevo.");
    }
};

export const extractStudentNames = async (file: { mimeType: string; data: string }): Promise<string[]> => {
    const promptText = `
    Analiza la imagen o documento proporcionado. Tu tarea es extraer EXCLUSIVAMENTE los nombres completos de los estudiantes listados.
    
    Instrucciones:
    1. Ignora encabezados, números de lista, notas, fechas, calificaciones o cualquier otro texto que no sea un nombre de persona.
    2. Si hay múltiples columnas, asegúrate de extraer los nombres de todas ellas.
    3. Devuelve los nombres en una lista simple.
    4. Si no encuentras nombres legibles, devuelve una lista vacía.
    `;

    const filePart = {
        inlineData: {
            mimeType: file.mimeType,
            data: file.data,
        },
    };

    const schema = {
        type: Type.OBJECT,
        properties: {
            names: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Lista de nombres extraídos."
            }
        },
        required: ["names"]
    };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [{ text: promptText }, filePart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: schema,
                temperature: 0.1, // Baja temperatura para mayor precisión en la extracción
            },
        });

        const jsonString = response.text.trim();
        const result = JSON.parse(jsonString);
        return result.names || [];

    } catch (error) {
        console.error("Error extracting names with Gemini:", error);
        throw new Error("No se pudieron extraer los nombres del archivo. Asegúrate de que el archivo sea legible.");
    }
};
