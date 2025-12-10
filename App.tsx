
import React, { useState, useCallback } from 'react';
import { Configuration, Strategy } from './types';
import ConfigurationPanel from './components/ConfigurationPanel';
import StrategyDisplay from './components/StrategyDisplay';
import Loader from './components/Loader';
import { generateStrategy } from './services/geminiService';

const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [strategy, setStrategy] = useState<Strategy | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = useCallback(async (config: Configuration) => {
        setIsLoading(true);
        setError(null);
        setStrategy(null);
        try {
            const result = await generateStrategy(config);
            setStrategy(result);
        } catch (err) {
            console.error(err);
            setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado al generar la estrategia.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleReset = useCallback(() => {
        setStrategy(null);
        setError(null);
        setIsLoading(false);
    }, []);

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">
            <header className="bg-white dark:bg-slate-800/50 shadow-sm sticky top-0 z-10 backdrop-blur-sm">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🧠</span>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">
                            Colabora<span className="text-sky-500">IA</span>
                        </h1>
                    </div>
                    {strategy && (
                        <button
                            onClick={handleReset}
                            className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-50 transition-colors duration-200 text-sm font-semibold"
                        >
                            Nueva Estrategia
                        </button>
                    )}
                </div>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {isLoading ? (
                    <Loader />
                ) : error ? (
                    <div className="text-center p-8 bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-700 rounded-lg">
                        <h2 className="text-xl font-bold text-red-700 dark:text-red-300 mb-2">Error</h2>
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                        <button
                            onClick={handleReset}
                            className="mt-6 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                            Intentar de Nuevo
                        </button>
                    </div>
                ) : strategy ? (
                    <StrategyDisplay strategy={strategy} />
                ) : (
                    <ConfigurationPanel onGenerate={handleGenerate} />
                )}
            </main>

             <footer className="text-center py-6 text-sm text-slate-500 dark:text-slate-400">
                <p>Desarrollado con IA para potenciar el aprendizaje colaborativo.</p>
            </footer>
        </div>
    );
};

export default App;
