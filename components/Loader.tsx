
import React from 'react';

const Loader: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <h2 className="mt-6 text-xl font-semibold text-slate-700 dark:text-slate-200">Generando Estrategia...</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400">La IA está analizando tu plan de clase. Esto puede tardar unos segundos.</p>
        </div>
    );
};

export default Loader;
