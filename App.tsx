

import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Screen } from './types';
import { supabase } from './supabaseClient';

// Fix for lines 733, 734, 745: Property 'google' does not exist on type 'Window'.
// This declares 'google' on the window object to satisfy TypeScript.
declare global {
    interface Window {
        google: any;
    }
}

// --- TYPE DEFINITIONS (from Supabase) ---
type Session = any;
type User = any;
type Profile = {
    id: string;
    full_name: string;
    avatar_url: string;
    phone?: string | null;
    latitude?: number;
    longitude?: number;
};
type Ride = {
    id: number;
    from_location: string;
    to_location: string;
    price: string;
    created_at: string;
    vehicle_type: string | null;
};


// --- APP CONTEXT & STATE ---
interface RideState {
    stage: 'none' | 'confirming_details' | 'final_confirmation' | 'searching_driver';
    from: string | null;
    to: string | null;
    vehicle: 'Simples' | 'Conforto' | null;
    price: string | null;
}

interface PaymentState {
    method: 'Cartão' | 'Pix' | 'Dinheiro' | null;
    details: string | null; // e.g., '**** 1234'
}

interface AppContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
    signOut: () => void;
    navigate: (screen: Screen, options?: { fromRideFlow?: boolean }) => void;
    rideState: RideState;
    setRideState: React.Dispatch<React.SetStateAction<RideState>>;
    paymentState: PaymentState;
    setPaymentState: React.Dispatch<React.SetStateAction<PaymentState>>;
    navigationOrigin: Screen | null;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppProvider');
    }
    return context;
};

// --- MOCK DATA (will be replaced by Supabase) ---
const mockAddresses = [
    "Shopping Central, Av. Principal",
    "Aeroporto Internacional de Guarulhos",
    "Parque Ibirapuera, Portão 3",
    "Museu de Arte de São Paulo (MASP)",
    "Rua Augusta, 900",
    "Centro Comercial Maringá, Leiria, Portugal",
    "Coimbra, Portugal",
];


// --- ICONS (unchanged) ---
const Logo: React.FC<{ className?: string }> = ({ className }) => (
    <h1 className={`text-5xl font-bold tracking-tighter text-white ${className}`}>Move</h1>
);

const GoogleIcon: React.FC = () => (
    <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48">
        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039L38.802 9.98C34.553 6.136 29.613 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>
        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.841-5.841C34.553 6.136 29.613 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path>
        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path>
        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.012 35.254 44 30.022 44 24c0-1.341-.138-2.65-.389-3.917z"></path>
    </svg>
);

const AppleIcon: React.FC = () => (
    <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
       <path d="M12.01,21.35c-1.4,0-2.86-0.67-3.8-1.92c-1.9-2.52-2.22-5.9-0.8-8.83c0.75-1.54,2.06-2.63,3.59-2.63 c0.97,0,2.15,0.58,2.99,0.58c0.83,0,1.79-0.56,2.83-0.56c1.83,0,3.1,1.17,3.92,2.83c-1.65,1-2.7,2.8-2.7,4.8 c0,3.23,2.51,4.41,2.8,4.5c-0.28,0.11-1.29,0.56-2.63,0.56c-1.49,0-2.34-0.89-3.83-0.89C14.01,20.46,13.1,21.35,12.01,21.35z M16.4,7.49c0.41-1.39,1.55-2.61,2.91-3.23c-1.43-1.02-3.23-1.18-4.44-0.22c-1.2,0.96-2.09,2.4-2.2,3.95 c1.53,0.21,3.12-0.59,3.73-0.49Z" />
    </svg>
);

const AppleIconLarge: React.FC = () => (
    <svg className="w-12 h-12 mx-auto text-black" viewBox="0 0 24 24" fill="currentColor">
       <path d="M12.01,21.35c-1.4,0-2.86-0.67-3.8-1.92c-1.9-2.52-2.22-5.9-0.8-8.83c0.75-1.54,2.06-2.63,3.59-2.63 c0.97,0,2.15,0.58,2.99,0.58c0.83,0,1.79-0.56,2.83-0.56c1.83,0,3.1,1.17,3.92,2.83c-1.65,1-2.7,2.8-2.7,4.8 c0,3.23,2.51,4.41,2.8,4.5c-0.28,0.11-1.29,0.56-2.63,0.56c-1.49,0-2.34-0.89-3.83-0.89C14.01,20.46,13.1,21.35,12.01,21.35z M16.4,7.49c0.41-1.39,1.55-2.61,2.91-3.23c-1.43-1.02-3.23-1.18-4.44-0.22c-1.2,0.96-2.09,2.4-2.2,3.95 c1.53,0.21,3.12-0.59,3.73-0.49Z" />
    </svg>
);

const MenuIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CarIcon: React.FC<{ comfort?: boolean; className?: string }> = ({ comfort, className="" }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-10 w-10 text-slate-800 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a1 1 0 00-1 1v1a1 1 0 002 0V3a1 1 0 00-1-1zM4 12a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm12 0a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1z"/>
        <path fillRule="evenodd" d="M18 8a2 2 0 00-2-2H4a2 2 0 00-2 2v4a1 1 0 001 1h1v1a2 2 0 002 2h8a2 2 0 002-2v-1h1a1 1 0 001-1V8zm-2 4h-2v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-1H4V8h12v4z" clipRule="evenodd" />
        {comfort && <path fillRule="evenodd" d="M13.802 3.92a.5.5 0 01.38.22l.21.364.21.363a.5.5 0 01-.1.68l-.21.21-.21.21a.5.5 0 01-.68-.1l-.21-.363-.21-.364a.5.5 0 01.22-.76zm-7.604 0a.5.5 0 01.68.1l.21.364.21.363a.5.5 0 01-.1.68l-.21.21-.21.21a.5.5 0 01-.68-.1l-.21-.363-.21-.364a.5.5 0 01.38-.22z" clipRule="evenodd" opacity="0.7"/>}
    </svg>
);

const CheckCircleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const CreditCardIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

const PixIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1.2 14.4V7.6h2.4v8.8h-2.4zm-4-4.8c0-.66.54-1.2 1.2-1.2s1.2.54 1.2 1.2-.54 1.2-1.2 1.2-1.2-.54-1.2-1.2zm6.4 0c0-.66.54-1.2 1.2-1.2s1.2.54 1.2 1.2-.54 1.2-1.2 1.2-1.2-.54-1.2-1.2z"/>
    </svg>
);

const CashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
);

const PencilIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
    </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const LocationTargetIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 text-gray-700 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
);

// --- REUSABLE UI COMPONENTS (unchanged) ---
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
    <input
        ref={ref}
        {...props}
        className={`w-full px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition disabled:opacity-50 disabled:cursor-not-allowed ${className || ''}`}
    />
));

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'secondary' | 'social';
}
const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
    const baseClasses = "w-full py-3 font-semibold rounded-lg shadow-md flex items-center justify-center transition";
    const variantClasses = {
        primary: "bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed",
        secondary: "bg-gray-200 text-slate-800 hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed",
        social: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed",
    };
    return (
        <button {...props} className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
            {children}
        </button>
    );
};

const ScreenWrapper: React.FC<{ title: string; onBack: () => void; children: React.ReactNode }> = ({ title, onBack, children }) => (
    <div className="w-full h-full bg-gray-50 flex flex-col animate-fade-in">
        <header className="bg-white shadow-sm p-4 flex items-center flex-shrink-0 z-10">
            <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
            </button>
            <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
        </header>
        <main className="flex-grow p-6 overflow-y-auto">
            {children}
        </main>
    </div>
);

const ToggleSwitch: React.FC<{ enabled: boolean; setEnabled: (enabled: boolean) => void }> = ({ enabled, setEnabled }) => {
    return (
        <button
            onClick={() => setEnabled(!enabled)}
            className={`${enabled ? 'bg-slate-800' : 'bg-gray-200'}
              relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none`}
            role="switch"
            aria-checked={enabled}
        >
            <span
                aria-hidden="true"
                className={`${enabled ? 'translate-x-5' : 'translate-x-0'}
                pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg transform ring-0 transition ease-in-out duration-200`}
            />
        </button>
    );
};


// --- SCREEN COMPONENTS ---

const SplashScreen: React.FC = () => {
    return (
        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center animate-fade-in">
            <Logo />
            <div className="absolute bottom-16 flex space-x-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-3 h-3 bg-white rounded-full animate-pulse [animation-delay:-0.1s]"></div>
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
            </div>
        </div>
    );
};

const SetupErrorScreen: React.FC<{ message: string }> = ({ message }) => {
    const { signOut } = useAppContext();
    return (
        <div className="w-full h-full bg-red-50 flex flex-col items-center justify-center p-8 text-center animate-fade-in">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-red-800 mt-6">Configuration Error</h2>
            <p className="text-red-700 mt-2 px-4 whitespace-pre-wrap">{message}</p>
            <div className="mt-8 w-full max-w-xs">
                <Button variant="secondary" onClick={signOut}>
                    Sign Out & Retry
                </Button>
            </div>
        </div>
    );
};


const LoginScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            // Navigation will be handled by the App's auth listener
        } catch (error: any) {
            setError(error.message || "Ocorreu um erro ao entrar.");
        } finally {
            setLoading(false);
        }
    };

    const handleOAuthLogin = async (provider: 'google' | 'apple') => {
        await supabase.auth.signInWithOAuth({ provider });
    };

    return (
        <div className="w-full h-full bg-white flex flex-col justify-center p-8 animate-fade-in">
            <div className="mb-10 text-center">
                <h2 className="text-3xl font-bold text-slate-800">Entrar na sua conta</h2>
                <p className="text-gray-500 mt-2">Use e-mail ou redes sociais</p>
            </div>
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleLogin}>
                <div className="space-y-4">
                    <Input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <Input placeholder="Senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <div className="mt-6">
                    <Button type="submit" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</Button>
                </div>
            </form>
            <a onClick={() => navigate(Screen.ForgotPassword)} className="text-sm text-slate-600 hover:underline text-center block mt-4 cursor-pointer">
                Esqueceu sua senha?
            </a>
            <div className="flex items-center my-6">
                <hr className="flex-grow border-gray-300" />
                <span className="mx-4 text-gray-400 font-medium">ou</span>
                <hr className="flex-grow border-gray-300" />
            </div>
            <div className="space-y-3">
                <Button variant="social" onClick={() => handleOAuthLogin('google')}>
                    <GoogleIcon />Entrar com Google
                </Button>
                <Button variant="social" className="text-black" onClick={() => handleOAuthLogin('apple')}>
                    <AppleIcon />Entrar com Apple
                </Button>
            </div>
            <p className="text-center text-sm text-gray-500 mt-8">
                Ainda não tem conta?{' '}
                <a onClick={() => navigate(Screen.SignUp)} className="font-semibold text-slate-600 hover:underline cursor-pointer">
                    Cadastre-se
                </a>
            </p>
        </div>
    );
};

const SignUpScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("As senhas não coincidem.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                        phone: phone,
                    }
                }
            });

            if (error) throw error;
            
            // On successful signup, navigate to a screen that instructs the user to check their email.
            navigate(Screen.SignUpSuccess);

        } catch (error: any) {
            setError(error.message || "Ocorreu um erro ao cadastrar.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full bg-white flex flex-col justify-center p-8 animate-fade-in">
            <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-slate-800">Criar Conta no Move</h2>
                <p className="text-gray-500 mt-2">É rápido e fácil!</p>
            </div>
             {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleSignUp} className="space-y-4">
                <Input placeholder="Nome completo" type="text" name="full_name" value={fullName} onChange={e => setFullName(e.target.value)} required />
                <Input placeholder="E-mail" type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} required />
                <Input placeholder="Número de celular" type="tel" name="phone" value={phone} onChange={e => setPhone(e.target.value)} />
                <Input placeholder="Senha" type="password" name="password" value={password} onChange={e => setPassword(e.target.value)} required />
                <Input placeholder="Confirmar senha" type="password" name="password_confirm" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                <div className="mt-2">
                    <Button type="submit" disabled={loading}>{loading ? 'Cadastrando...' : 'Cadastrar'}</Button>
                </div>
            </form>
            <p className="text-center text-sm text-gray-500 mt-8">
                Já tem conta?{' '}
                <a onClick={() => navigate(Screen.Login)} className="font-semibold text-slate-600 hover:underline cursor-pointer">
                    Entrar
                </a>
            </p>
        </div>
    );
};

const SignUpSuccessScreen: React.FC = () => {
    const { navigate } = useAppContext();

    return (
        <div className="w-full h-full bg-white flex flex-col items-center p-8 animate-fade-in">
            <div className="flex-grow flex flex-col justify-center items-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <h2 className="text-3xl font-bold text-slate-800 mt-6">Verifique seu e-mail</h2>
                <p className="text-gray-500 mt-2 px-4">
                    Enviamos um link de confirmação para sua caixa de entrada. Clique no link para ativar sua conta.
                </p>
            </div>
            <div className="w-full pb-4">
                 <Button variant="secondary" onClick={() => navigate(Screen.Login)}>Voltar para Login</Button>
            </div>
        </div>
    );
};


const SideMenu: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { navigate, profile, signOut } = useAppContext();
    
    const menuItems = [
        { label: "Perfil", screen: Screen.Profile },
        { label: "Histórico de Corridas", screen: Screen.History },
        { label: "Pagamentos", screen: Screen.Payments },
        { label: "Suporte", screen: Screen.Support },
        { label: "Configurações", screen: Screen.Settings },
    ];

    return (
        <>
            <div
                onClick={onClose}
                className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
            />
            <div
                className={`fixed top-0 left-0 h-full w-4/5 max-w-sm bg-white shadow-xl z-50 transform transition-transform ${
                    isOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="p-6 bg-slate-800 text-white">
                    <div className="flex items-center">
                        <div className="w-16 h-16 rounded-full bg-gray-500 mr-4 overflow-hidden">
                             <img src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${profile?.full_name || 'U'}&background=random`} alt="User" className="w-full h-full object-cover"/>
                        </div>
                        <div>
                            <h3 className="font-bold text-xl">{profile?.full_name || 'Usuário'}</h3>
                        </div>
                    </div>
                </div>
                <nav className="mt-6">
                    <ul>
                        {menuItems.map(item => (
                             <li key={item.label}>
                                <a onClick={() => { navigate(item.screen); onClose(); }} className="block py-4 px-6 text-slate-700 hover:bg-gray-100 cursor-pointer transition">
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
                <div className="absolute bottom-0 left-0 w-full p-6">
                     <a onClick={signOut} className="block py-4 text-center text-red-500 hover:bg-red-50 rounded-lg cursor-pointer transition">
                        Sair
                    </a>
                </div>
            </div>
        </>
    );
};

const RideRequestPanel: React.FC = () => {
    const { rideState, setRideState } = useAppContext();
    const [selectedVehicle, setSelectedVehicle] = useState<'Simples' | 'Conforto'>('Simples');

    const simplePrice = (Math.random() * 5 + 15).toFixed(2).replace('.', ',');
    const comfortPrice = (parseFloat(simplePrice.replace(',', '.')) * 1.5).toFixed(2).replace('.', ',');

    const handleConfirm = () => {
        setRideState(prev => ({
            ...prev,
            stage: 'final_confirmation',
            vehicle: selectedVehicle,
            price: selectedVehicle === 'Simples' ? `R$ ${simplePrice}` : `R$ ${comfortPrice}`
        }));
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 z-30 animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Detalhes da Viagem</h3>
                 <button onClick={() => setRideState({ stage: 'none', from: null, to: null, vehicle: null, price: null })} className="p-1 rounded-full hover:bg-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <div className="text-center mb-4">
                <p className="text-3xl font-bold text-slate-800">15 min</p>
                <p className="text-gray-500">Estimativa de chegada</p>
            </div>

            <div className="space-y-3 mb-4">
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-gray-500 rounded-full mr-3"></div>
                    <p className="text-gray-700 truncate">{rideState.from}</p>
                </div>
                <div className="flex items-center">
                    <div className="w-3 h-3 bg-blue-500 rounded-full mr-3"></div>
                    <p className="text-gray-700 font-semibold truncate">{rideState.to}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
                <button 
                    onClick={() => setSelectedVehicle('Simples')}
                    className={`p-3 rounded-lg border-2 transition text-left ${selectedVehicle === 'Simples' ? 'bg-slate-100 border-slate-800' : 'bg-white border-gray-200'}`}
                >
                    <CarIcon />
                    <p className="font-bold mt-1">Simples</p>
                    <p className="font-semibold text-sm">R$ {simplePrice}</p>
                </button>
                 <button 
                    onClick={() => setSelectedVehicle('Conforto')}
                    className={`p-3 rounded-lg border-2 transition text-left ${selectedVehicle === 'Conforto' ? 'bg-slate-100 border-slate-800' : 'bg-white border-gray-200'}`}
                >
                    <CarIcon comfort />
                    <p className="font-bold mt-1">Conforto</p>
                    <p className="font-semibold text-sm">R$ {comfortPrice}</p>
                </button>
            </div>

            <Button onClick={handleConfirm}>Confirmar Viagem</Button>
        </div>
    );
};

const FinalConfirmationPanel: React.FC = () => {
    const { navigate, rideState, setRideState, paymentState, user } = useAppContext();

    const handleRequestRide = async () => {
        if (!user) {
            alert("Você precisa estar logado para solicitar uma corrida.");
            return;
        }
        setRideState(prev => ({...prev, stage: 'searching_driver'}));

        // Save the ride to Supabase
        const { error } = await supabase.from('rides').insert({
            user_id: user.id,
            from_location: rideState.from,
            to_location: rideState.to,
            price: rideState.price,
            vehicle_type: rideState.vehicle,
        });

        if (error) {
            console.error("Error saving ride:", error);
            // Optionally, handle the error in the UI
        }
    };
    
    const PaymentIcon = () => {
        switch (paymentState.method) {
            case 'Cartão': return <CreditCardIcon className="text-slate-600"/>;
            case 'Pix': return <PixIcon className="text-green-500"/>;
            case 'Dinheiro': return <CashIcon className="text-blue-500"/>;
            default: return null;
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-4 z-30 animate-fade-in">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-lg">Confirme sua corrida</h3>
                <button onClick={() => setRideState(prev => ({ ...prev, stage: 'confirming_details' }))} className="p-1 rounded-full hover:bg-gray-200">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
            </div>
            
            <div className="bg-slate-50 p-3 rounded-lg mb-4 flex justify-between items-center">
                <div className="flex items-center">
                    <CarIcon comfort={rideState.vehicle === 'Conforto'} className="h-8 w-8 mr-3"/>
                    <div>
                        <p className="font-bold">{rideState.vehicle}</p>
                        <p className="text-sm text-gray-500">15 min</p>
                    </div>
                </div>
                <p className="font-bold text-lg">{rideState.price}</p>
            </div>

            <div className="mb-4">
                <button 
                    onClick={() => navigate(Screen.Payments, { fromRideFlow: true })}
                    className="w-full text-left p-3 flex items-center bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                    {paymentState.method ? <PaymentIcon /> : <CreditCardIcon className="text-slate-600"/>}
                    <span className="ml-3 font-medium text-gray-800 flex-grow">
                         {paymentState.method ? `${paymentState.method} ${paymentState.details || ''}` : 'Adicionar forma de pagamento'}
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <Button onClick={handleRequestRide} disabled={!paymentState.method}>
                Ok! Solicitar Corrida
            </Button>
        </div>
    );
};

const SearchingForDriverPanel: React.FC = () => {
    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl p-6 z-30 text-center animate-fade-in">
            <h3 className="text-xl font-bold text-slate-800">Procurando um motorista</h3>
             <p className="text-gray-500 mt-2">Aguarde um momento...</p>
            <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden mt-6">
                <div className="absolute h-full bg-slate-800 w-1/2 animate-search-bar"></div>
            </div>
            <style>{`
                @keyframes search-bar {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(200%); }
                }
                .animate-search-bar {
                    animation: search-bar 1.5s infinite linear;
                }
            `}</style>
        </div>
    );
};

const LocationRequestPopup: React.FC<{ onAllow: () => void; onDeny: () => void; }> = ({ onAllow, onDeny }) => {
    return (
        <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-8 animate-fade-in">
            <div className="bg-white rounded-2xl p-6 text-center max-w-sm shadow-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h2 className="text-2xl font-bold text-slate-800 mt-4">Permitir Localização</h2>
                <p className="text-gray-600 mt-2">O Move precisa da sua localização para oferecer a melhor experiência de viagem e encontrar motoristas próximos.</p>
                <div className="mt-6 flex flex-col space-y-3">
                    <Button onClick={onAllow}>Permitir Localização</Button>
                    <Button onClick={onDeny} variant="secondary">Não</Button>
                </div>
            </div>
        </div>
    );
};

const PermissionDeniedPopup: React.FC<{ onClose: () => void; }> = ({ onClose }) => (
    <div className="absolute inset-0 bg-black/50 z-50 flex items-center justify-center p-8 animate-fade-in">
        <div className="bg-white rounded-2xl p-6 text-center max-w-sm shadow-xl">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-slate-800 mt-4">Permissão de Localização Negada</h2>
            <p className="text-gray-600 mt-2">
                Para usar o Move, precisamos da sua localização. Parece que a permissão foi negada.
                Por favor, habilite-a manualmente nas configurações de site do seu navegador para continuar.
            </p>
            <div className="mt-6">
                <Button onClick={onClose} variant="secondary">Entendi</Button>
            </div>
        </div>
    </div>
);


const MainMapScreen: React.FC = () => {
    const { navigate, user, rideState } = useAppContext();
    const [isMenuOpen, setMenuOpen] = useState(false);
    
    const [permissionState, setPermissionState] = useState<'checking' | 'prompt' | 'granted' | 'denied'>('checking');
    const [geolocationError, setGeolocationError] = useState<string | null>(null);

    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any | null>(null);
    const markerRef = useRef<any | null>(null);
    const watchIdRef = useRef<number | null>(null);

    const updateMapAndProfile = async (position: GeolocationPosition) => {
        setGeolocationError(null);
        const { latitude, longitude } = position.coords;
        const newPos = { lat: latitude, lng: longitude };

        if (mapRef.current && !mapInstanceRef.current && window.google) {
            const mapStyles: any[] = [ { elementType: "geometry", stylers: [{ color: "#242f3e" }] }, { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] }, { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] }, { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }], }, { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }], }, { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#263c3f" }], }, { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#6b9a76" }], }, { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }], }, { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212a37" }], }, { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#9ca5b3" }], }, { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#746855" }], }, { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1f2835" }], }, { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#f3d19c" }], }, { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }], }, { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#d59563" }], }, { featureType: "water", elementType: "geometry", stylers: [{ color: "#17263c" }], }, { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#515c6d" }], }, { featureType: "water", elementType: "labels.text.stroke", stylers: [{ color: "#17263c" }], }, ];
            mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
                center: newPos,
                zoom: 17,
                disableDefaultUI: true,
                styles: mapStyles,
            });
        }

        if (mapInstanceRef.current) {
            mapInstanceRef.current.setCenter(newPos);
            if (!markerRef.current) {
                markerRef.current = new window.google.maps.Marker({
                    position: newPos,
                    map: mapInstanceRef.current,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: '#4285F4',
                        fillOpacity: 1,
                        strokeColor: 'white',
                        strokeWeight: 2,
                    }
                });
            } else {
                markerRef.current.setPosition(newPos);
            }
        }

        if (user) {
            const { error } = await supabase
                .from('profiles')
                .update({ latitude: latitude, longitude: longitude, updated_at: new Date().toISOString() })
                .eq('id', user.id);
            if (error) console.error("Error updating user location in Supabase:", error);
        }
    };

    const startWatchingPosition = () => {
        if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
        
        const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 };
        watchIdRef.current = navigator.geolocation.watchPosition(
            updateMapAndProfile,
            (error) => {
                console.warn("Error watching location:", error);
                if(error.code === error.PERMISSION_DENIED) {
                    setPermissionState('denied');
                    setGeolocationError("A permissão de localização foi revogada. Por favor, habilite-a novamente nas configurações.");
                    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
                }
            },
            options
        );
    };
    
    const acquireLocationAndStartTracking = () => {
        if (!('geolocation' in navigator)) {
            setGeolocationError("Geolocalização não é suportada pelo seu navegador.");
            setPermissionState('denied');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setPermissionState('granted');
                updateMapAndProfile(position);
                startWatchingPosition();
            },
            (error) => {
                if (error.code === error.PERMISSION_DENIED) {
                    setPermissionState('denied');
                    setGeolocationError("A permissão de localização foi negada. Por favor, habilite-a nas configurações do seu navegador.");
                } else {
                    setGeolocationError("Não foi possível obter a sua localização. Verifique sua conexão e tente novamente.");
                    setPermissionState('denied'); // Show error and stop trying
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    useEffect(() => {
        let permissionStatus: PermissionStatus | null = null;

        const handlePermissionChange = () => {
            if (permissionStatus) {
                if (permissionStatus.state === 'granted') {
                    acquireLocationAndStartTracking();
                } else if (permissionStatus.state === 'denied') {
                    setPermissionState('denied');
                    setGeolocationError("A permissão de localização foi negada. Por favor, habilite-a nas configurações do seu navegador.");
                } else {
                    setPermissionState('prompt');
                }
            }
        }

        if (navigator.permissions) {
            navigator.permissions.query({ name: 'geolocation' }).then(status => {
                permissionStatus = status;
                handlePermissionChange(); // Initial check
                status.onchange = handlePermissionChange; // Listen for changes
            });
        } else {
            // Fallback for browsers that don't support Permissions API.
            // We can't know the state, so we'll show our in-app prompt.
            setPermissionState('prompt');
        }

        return () => {
            if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
            if (permissionStatus) {
                permissionStatus.onchange = null;
            }
        };
    }, []);

    const handleAllowLocation = () => {
        acquireLocationAndStartTracking();
    };

    const handleDenyLocation = () => {
        setPermissionState('denied');
        setGeolocationError("A permissão de localização é necessária para o funcionamento completo do mapa.");
    };


    const renderPanel = () => {
        switch(rideState.stage) {
            case 'confirming_details':
                return <RideRequestPanel />;
            case 'final_confirmation':
                return <FinalConfirmationPanel />;
            case 'searching_driver':
                return <SearchingForDriverPanel />;
            default:
                return null;
        }
    };

    return (
        <div className="w-full h-full relative overflow-hidden">
            <div ref={mapRef} className="absolute inset-0 w-full h-full bg-gray-800" />
            
            {permissionState === 'prompt' && <LocationRequestPopup onAllow={handleAllowLocation} onDeny={handleDenyLocation} />}

            <SideMenu isOpen={isMenuOpen} onClose={() => setMenuOpen(false)} />
            
            {permissionState === 'granted' && (
                <>
                    <div className="absolute top-0 left-0 right-0 p-5 flex justify-between items-center z-30">
                         <button onClick={() => setMenuOpen(true)} className="p-3 bg-white rounded-full shadow-lg">
                            <MenuIcon />
                         </button>
                    </div>
                    <div className="absolute top-24 left-5 right-5 z-20">
                        {rideState.stage === 'none' && (
                            <button onClick={() => navigate(Screen.SearchDestination)} className="w-full bg-white rounded-lg shadow-lg p-4 flex items-center space-x-3 text-left animate-fade-in">
                                <SearchIcon className="text-gray-900" />
                                <span className="text-gray-900 text-xl font-semibold">Para onde vamos?</span>
                            </button>
                        )}
                    </div>
                     <button className="absolute bottom-24 right-5 bg-white p-3 rounded-full shadow-lg z-20"
                        onClick={() => {
                            if (mapInstanceRef.current && markerRef.current) {
                                mapInstanceRef.current.panTo(markerRef.current.getPosition()!);
                            }
                        }}
                    >
                        <LocationTargetIcon />
                    </button>
                </>
            )}

            {permissionState === 'denied' && (
                <div className="absolute top-24 left-5 right-5 z-20">
                     <div className="w-full bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-r-lg shadow-md animate-fade-in" role="alert">
                        <p className="font-bold">Aviso de Localização</p>
                        <p>{geolocationError}</p>
                    </div>
                </div>
            )}
            
            {renderPanel()}
        </div>
    );
};


const PaymentsScreen: React.FC = () => {
    const { navigate, navigationOrigin, setPaymentState } = useAppContext();
    const [isAddingCard, setIsAddingCard] = useState(false);

    const handleSaveCard = () => {
        setPaymentState({ method: 'Cartão', details: '**** 4242' });
        if (navigationOrigin === Screen.MainMap) {
            navigate(Screen.MainMap);
        } else {
            setIsAddingCard(false);
        }
    };
    
    const handleSelectPayment = (method: 'Cartão' | 'Pix' | 'Dinheiro') => {
        if (method === 'Cartão') {
            setIsAddingCard(true);
            return;
        }
        setPaymentState({ method, details: null });
        if (navigationOrigin === Screen.MainMap) {
            navigate(Screen.MainMap);
        }
    }

    return (
        <div className="w-full h-full bg-gray-50 flex flex-col animate-fade-in">
            <header className="bg-white shadow-sm p-4 flex items-center flex-shrink-0 z-10">
                <button
                    onClick={() => {
                        if (isAddingCard) {
                            setIsAddingCard(false);
                        } else if (navigationOrigin === Screen.MainMap) {
                            navigate(Screen.MainMap);
                        } else {
                            navigate(Screen.MainMap);
                        }
                    }}
                    className="p-2 rounded-full hover:bg-gray-100 mr-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-xl font-semibold text-slate-800">
                    {isAddingCard ? 'Adicionar Cartão' : 'Pagamentos'}
                </h2>
            </header>

            <main className="flex-grow p-6 overflow-y-auto">
                {isAddingCard ? (
                    <div className="animate-fade-in">
                        <p className="text-sm text-gray-600 mb-6">Insira os detalhes do seu cartão de crédito ou débito.</p>
                        <div className="space-y-4">
                            <Input placeholder="Número do Cartão" type="tel" inputMode="numeric" pattern="[0-9\s]{13,19}" autoComplete="cc-number" maxLength={19} />
                            <div className="flex space-x-4">
                                <Input placeholder="Validade (MM/AA)" type="text" autoComplete="cc-exp" />
                                <Input placeholder="CVV" type="tel" inputMode="numeric" maxLength={4} autoComplete="cc-csc" />
                            </div>
                            <Input placeholder="Nome do Titular" type="text" autoComplete="cc-name" />
                        </div>
                        <div className="mt-8 flex space-x-4">
                            <Button variant="secondary" onClick={() => setIsAddingCard(false)}>Cancelar</Button>
                            <Button onClick={handleSaveCard}>Salvar</Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Adicionar forma de pagamento</h3>
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                            <button onClick={() => handleSelectPayment('Cartão')} className="w-full text-left p-4 flex items-center hover:bg-gray-50 transition border-b border-gray-200">
                                <CreditCardIcon className="text-slate-600"/>
                                <span className="ml-4 font-medium text-gray-800">Cartão de crédito ou débito</span>
                            </button>
                            <button onClick={() => handleSelectPayment('Pix')} className="w-full text-left p-4 flex items-center hover:bg-gray-50 transition border-b border-gray-200">
                                <PixIcon className="text-green-500"/>
                                <span className="ml-4 font-medium text-gray-800">Pix</span>
                            </button>
                            <button onClick={() => handleSelectPayment('Dinheiro')} className="w-full text-left p-4 flex items-center hover:bg-gray-50 transition">
                                <CashIcon className="text-blue-500"/>
                                <span className="ml-4 font-medium text-gray-800">Dinheiro</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

const ProfileScreen: React.FC = () => {
    const { navigate, user, profile: initialProfile, setProfile } = useAppContext();
    const [loading, setLoading] = useState(false);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (initialProfile) {
            setFullName(initialProfile.full_name || '');
            setAvatarUrl(initialProfile.avatar_url || null);
            setPhone(initialProfile.phone || '');
        }
    }, [initialProfile]);

    const handleUpdateProfile = async () => {
        if (!user) return;
        setLoading(true);
        const updates = {
            id: user.id,
            full_name: fullName,
            phone: phone,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
        };

        const { data, error } = await supabase
            .from('profiles')
            .upsert(updates)
            .select()
            .single();

        if (error) {
            alert(error.message);
        } else if (data) {
            setProfile(data); // Update the global profile state
            alert('Perfil atualizado!');
            navigate(Screen.MainMap);
        }
        setLoading(false);
    };

    const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) {
            return;
        }
        const file = event.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}-${Math.random()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file);

        if (uploadError) {
            console.error('Error uploading avatar:', uploadError);
            return;
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
        setAvatarUrl(data.publicUrl);
    };

    const handleEditClick = () => {
        fileInputRef.current?.click();
    };

    return (
        <ScreenWrapper title="Meu Perfil" onBack={() => navigate(Screen.MainMap)}>
             <div className="flex flex-col items-center mb-8">
                <input type="file" ref={fileInputRef} onChange={handleImageChange} accept="image/*" className="hidden"/>
                <div className="relative">
                    <img src={avatarUrl || `https://ui-avatars.com/api/?name=${fullName || user?.email || 'U'}&background=random`} alt="User" className="w-24 h-24 rounded-full object-cover shadow-md ring-2 ring-white" />
                    <button onClick={handleEditClick} className="absolute -bottom-1 -right-1 bg-slate-800 text-white p-2 rounded-full shadow-md border-2 border-gray-50 hover:bg-slate-700 transition" aria-label="Change profile picture">
                        <PencilIcon />
                    </button>
                </div>
            </div>

            <div className="space-y-5">
                <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">Nome completo</label>
                    <Input value={fullName} onChange={e => setFullName(e.target.value)} name="full_name"/>
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">E-mail</label>
                    <Input value={user?.email || ''} type="email" disabled name="email" />
                </div>
                 <div>
                    <label className="text-sm font-medium text-gray-600 mb-1 block">Número de celular</label>
                    <Input value={phone} onChange={e => setPhone(e.target.value)} type="tel" name="phone" placeholder="Seu telefone"/>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 space-y-4">
                 <Button variant="secondary" onClick={() => navigate(Screen.ChangePassword)}>Alterar senha</Button>
                 <Button onClick={handleUpdateProfile} disabled={loading}>{loading ? 'Salvando...' : 'Salvar'}</Button>
            </div>
        </ScreenWrapper>
    );
};

const ChangePasswordScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSuccess, setShowSuccess] = useState(false);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            setError(error.message);
        } else {
            setShowSuccess(true);
            setTimeout(() => navigate(Screen.Profile), 2000);
        }
        setLoading(false);
    };

    return (
        <ScreenWrapper title="Alterar Senha" onBack={() => navigate(Screen.Profile)}>
            {showSuccess ? (
                <div className="text-center p-8 bg-green-50 rounded-lg animate-fade-in">
                    <CheckCircleIcon />
                    <h3 className="text-xl font-semibold text-green-700 mt-4">Senha alterada com sucesso!</h3>
                </div>
            ) : (
                <form onSubmit={handleSave} className="space-y-4">
                    {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center">{error}</p>}
                    <p className="text-gray-600">Digite sua nova senha. Você será desconectado de outras sessões.</p>
                    <Input placeholder="Nova senha" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <div className="pt-4">
                        <Button type="submit" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</Button>
                    </div>
                </form>
            )}
        </ScreenWrapper>
    );
};

const SettingsScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);

    return (
        <ScreenWrapper title="Configurações" onBack={() => navigate(Screen.MainMap)}>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 flex justify-between items-center border-b border-gray-200">
                    <div>
                        <h4 className="font-medium text-gray-800">Notificações</h4>
                        <p className="text-sm text-gray-500">Receber alertas de corridas e promoções.</p>
                    </div>
                    <ToggleSwitch enabled={notificationsEnabled} setEnabled={setNotificationsEnabled} />
                </div>
                <div className="p-4 flex justify-between items-center">
                    <h4 className="font-medium text-gray-800">Versão do Aplicativo</h4>
                    <span className="text-gray-600 font-medium">1.0.0</span>
                </div>
                <button
                    onClick={() => navigate(Screen.TermsAndPolicy)}
                    className="w-full text-left p-4 flex items-center hover:bg-gray-50 transition border-t border-gray-200"
                >
                    <span className="font-medium text-gray-800">Termos de Uso</span>
                </button>
                <button
                    onClick={() => navigate(Screen.PrivacyPolicy)}
                    className="w-full text-left p-4 flex items-center hover:bg-gray-50 transition border-t border-gray-200"
                >
                    <span className="font-medium text-gray-800">Política de Privacidade</span>
                </button>
            </div>
        </ScreenWrapper>
    );
};

const SupportScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const supportItems = [
        { label: "Central de Ajuda", screen: Screen.HelpCenter },
        { label: "Falar com o Suporte", screen: Screen.ContactSupport },
        { label: "Relatar Problema com Corrida", screen: Screen.ReportProblem },
    ];
    return (
        <ScreenWrapper title="Suporte" onBack={() => navigate(Screen.MainMap)}>
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {supportItems.map((item, index) => (
                    <button
                        key={item.label}
                        onClick={() => navigate(item.screen)}
                        className={`w-full text-left p-4 flex items-center hover:bg-gray-50 transition ${index < supportItems.length - 1 ? 'border-b border-gray-200' : ''}`}
                    >
                        <span className="font-medium text-gray-800">{item.label}</span>
                    </button>
                ))}
            </div>
        </ScreenWrapper>
    );
};

const HelpCenterScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return (
        <ScreenWrapper title="Central de Ajuda" onBack={() => navigate(Screen.Support)}>
            <div className="space-y-6 text-gray-700">
                <div>
                    <h3 className="text-lg font-semibold mb-2 text-slate-800">Como peço uma corrida?</h3>
                    <p>Abra o aplicativo, insira seu destino no campo "Para onde vamos?" e confirme o local de partida. Em seguida, veja as opções de veículos e tarifas e toque em "Confirmar" para solicitar sua viagem.</p>
                </div>
                 <div>
                    <h3 className="text-lg font-semibold mb-2 text-slate-800">Como altero minha senha?</h3>
                    <p>Vá para "Perfil" no menu lateral, e lá você encontrará a opção "Alterar senha". Você precisará estar logado para definir uma nova.</p>
                </div>
            </div>
        </ScreenWrapper>
    );
};

const ContactSupportScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [sent, setSent] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSent(true);
        setTimeout(() => navigate(Screen.Support), 2500);
    };

    return (
        <ScreenWrapper title="Falar com o Suporte" onBack={() => navigate(Screen.Support)}>
            {sent ? (
                 <div className="text-center p-8 bg-green-50 rounded-lg animate-fade-in">
                    <CheckCircleIcon />
                    <h3 className="text-xl font-semibold text-green-700 mt-4">Mensagem enviada!</h3>
                    <p className="text-gray-600 mt-2">Nossa equipe responderá em breve no seu e-mail.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                        className="w-full px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition h-32"
                        placeholder="Digite sua mensagem aqui..."
                        required
                    ></textarea>
                    <div className="pt-2">
                        <Button type="submit">Enviar Mensagem</Button>
                    </div>
                </form>
            )}
        </ScreenWrapper>
    );
};

const TermsAndPolicyScreen: React.FC<{ mode: 'terms' | 'policy' }> = ({ mode }) => {
    const { navigate } = useAppContext();
    const isTerms = mode === 'terms';
    const title = isTerms ? "Termos de Uso" : "Política de Privacidade";
    return (
        <ScreenWrapper title={title} onBack={() => navigate(Screen.Settings)}>
             <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
                <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
                <p>Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.</p>
            </div>
        </ScreenWrapper>
    );
};

const HistoryScreen: React.FC = () => {
    const { navigate, user } = useAppContext();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRides = async () => {
            if (!user) return;
            setLoading(true);
            const { data, error } = await supabase
                .from('rides')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Error fetching rides:', error.message);
            } else {
                setRides(data as Ride[]);
            }
            setLoading(false);
        };
        fetchRides();
    }, [user]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    return (
        <ScreenWrapper title="Histórico de Corridas" onBack={() => navigate(Screen.MainMap)}>
            {loading ? <p>Carregando histórico...</p> :
            <div className="space-y-4">
                {rides.length === 0 && <p className="text-center text-gray-500">Nenhuma corrida encontrada.</p>}
                {rides.map(ride => (
                    <div key={ride.id} className="bg-white p-4 rounded-xl shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-gray-500">{formatDate(ride.created_at)}</p>
                                <p className="font-semibold text-gray-800 mt-1 truncate">{ride.from_location}</p>
                                <p className="text-sm text-gray-600 truncate">para {ride.to_location}</p>
                            </div>
                            <p className="font-bold text-slate-800">{ride.price}</p>
                        </div>
                    </div>
                ))}
            </div>}
        </ScreenWrapper>
    );
};

const ReportProblemScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [sent, setSent] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSent(true);
        setTimeout(() => navigate(Screen.Support), 2500);
    };
    return (
        <ScreenWrapper title="Relatar Problema" onBack={() => navigate(Screen.Support)}>
            {sent ? (
                 <div className="text-center p-8 bg-green-50 rounded-lg animate-fade-in">
                    <CheckCircleIcon />
                    <h3 className="text-xl font-semibold text-green-700 mt-4">Relato enviado!</h3>
                    <p className="text-gray-600 mt-2">Agradecemos o seu feedback. Analisaremos o problema.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <textarea
                        className="w-full px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-slate-500 transition h-40"
                        placeholder="Descreva o problema em detalhes..."
                        required
                    ></textarea>
                     <div className="pt-2">
                        <Button type="submit">Enviar Relato</Button>
                    </div>
                </form>
            )}
        </ScreenWrapper>
    );
};

const ForgotPasswordScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin, // URL to redirect to after password reset
        });
        if (error) {
            setError(error.message);
        } else {
            setSent(true);
        }
        setLoading(false);
    };

    return (
        <ScreenWrapper title="Recuperar Senha" onBack={() => navigate(Screen.Login)}>
            {sent ? (
                 <div className="text-center p-8 bg-green-50 rounded-lg animate-fade-in">
                    <CheckCircleIcon />
                    <h3 className="text-xl font-semibold text-green-700 mt-4">Link enviado!</h3>
                    <p className="text-gray-600 mt-2">Verifique seu e-mail para redefinir sua senha.</p>
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                     {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center">{error}</p>}
                    <p className="text-gray-600 text-center">Insira seu e-mail para receber um link de recuperação de senha.</p>
                    <Input placeholder="Seu e-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} required/>
                    <div className="pt-2">
                        <Button type="submit" disabled={loading}>{loading ? 'Enviando...' : 'Enviar Link'}</Button>
                    </div>
                </form>
            )}
        </ScreenWrapper>
    );
};

const SearchDestinationScreen: React.FC = () => {
    const { navigate, setRideState, profile } = useAppContext();
    const [fromAddress, setFromAddress] = useState('Obtendo sua localização...');
    const [to, setTo] = useState('');
    const [predictions, setPredictions] = useState<any[]>([]);
    const toInputRef = useRef<HTMLInputElement>(null);
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (window.google && mapRef.current && profile?.latitude && profile?.longitude) {
            const userLocation = { lat: profile.latitude, lng: profile.longitude };
            
            const map = new window.google.maps.Map(mapRef.current, {
                center: userLocation,
                zoom: 16,
                disableDefaultUI: true,
                gestureHandling: 'none',
            });
            
            new window.google.maps.Marker({
                position: userLocation,
                map: map,
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4285F4',
                    fillOpacity: 1,
                    strokeColor: 'white',
                    strokeWeight: 2,
                }
            });

            const geocoder = new window.google.maps.Geocoder();
            geocoder.geocode({ location: userLocation }, (results: any, status: any) => {
                if (status === 'OK' && results?.[0]) {
                    setFromAddress(results[0].formatted_address);
                } else {
                    console.error('Geocoder failed due to: ' + status);
                    setFromAddress('Endereço atual não encontrado');
                }
            });
        }
    }, [profile?.latitude, profile?.longitude]);

    useEffect(() => {
        if (to.length > 2 && window.google) {
            const autocompleteService = new window.google.maps.places.AutocompleteService();
            autocompleteService.getPlacePredictions({ 
                input: to, 
                componentRestrictions: { country: 'pt' } 
            }, (results: any) => {
                setPredictions(results || []);
            });
        } else {
            setPredictions([]);
        }
    }, [to]);
    
    useEffect(() => {
        toInputRef.current?.focus();
    }, []);

    const handleSelectPrediction = (prediction: any) => {
        setTo(prediction.description);
        setPredictions([]);
        toInputRef.current?.focus();
    };

    const handleConfirm = () => {
        if (fromAddress && to && !fromAddress.startsWith('Obtendo') && !fromAddress.startsWith('Endereço')) {
            setRideState({
                stage: 'confirming_details',
                from: fromAddress,
                to: to,
                vehicle: null,
                price: null,
            });
            navigate(Screen.MainMap);
        }
    };

    return (
        <div className="w-full h-full relative flex flex-col animate-fade-in">
            <div ref={mapRef} className="absolute inset-0 w-full h-full bg-gray-300" />
            <div className="absolute inset-0 w-full h-full bg-black/10" />

            <header className="bg-white/80 backdrop-blur-md p-4 flex items-center flex-shrink-0 z-10 shadow-sm">
                <button onClick={() => navigate(Screen.MainMap)} className="p-2 rounded-full hover:bg-gray-100 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-xl font-semibold text-slate-800">Definir Trajeto</h2>
            </header>

            <main className="flex-grow p-4 flex flex-col z-10">
                <div className="bg-white p-4 rounded-xl shadow-lg">
                    <div className="relative mb-3">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-gray-500 rounded-full ring-2 ring-white"></div>
                        <Input
                            value={fromAddress}
                            onChange={(e) => setFromAddress(e.target.value)}
                            className="pl-8 font-medium"
                            disabled={fromAddress.startsWith('Obtendo')}
                        />
                    </div>
                     <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 bg-blue-500 rounded-full ring-2 ring-white"></div>
                        <Input
                            ref={toInputRef}
                            placeholder="Para onde vamos?"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            className="pl-8 font-medium"
                        />
                    </div>
                </div>

                {predictions.length > 0 && (
                    <div className="bg-white rounded-xl shadow-lg mt-4 animate-fade-in">
                        <ul>
                            {predictions.map((prediction, index) => (
                                <li key={prediction.place_id}>
                                    <button 
                                        onClick={() => handleSelectPrediction(prediction)} 
                                        className={`w-full text-left p-4 flex items-center hover:bg-gray-100 rounded-lg transition ${index < predictions.length - 1 ? 'border-b border-gray-100' : ''}`}
                                    >
                                        <div className="mr-4 flex-shrink-0">
                                            <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">{prediction.structured_formatting.main_text}</p>
                                            <p className="text-sm text-gray-500">{prediction.structured_formatting.secondary_text}</p>
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                
                 <div className="mt-auto pt-4">
                    <Button onClick={handleConfirm} disabled={!fromAddress || !to || fromAddress.startsWith('Obtendo')}>
                        Confirmar Trajeto
                    </Button>
                </div>
            </main>
        </div>
    );
};


const authScreens = [Screen.Login, Screen.SignUp, Screen.SignUpSuccess, Screen.ForgotPassword, Screen.LoginWithApple, Screen.LoginWithGoogle];

const App: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SplashScreen);
    const [navigationOrigin, setNavigationOrigin] = useState<Screen | null>(null);
    const [setupError, setSetupError] = useState<string | null>(null);
    const [rideState, setRideState] = useState<RideState>({
        stage: 'none',
        from: null,
        to: null,
        vehicle: null,
        price: null,
    });
    const [paymentState, setPaymentState] = useState<PaymentState>({
        method: 'Cartão',
        details: '**** 1234'
    });

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setLoading(false);
        };
        getSession();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => authListener.subscription.unsubscribe();
    }, []);
    
    useEffect(() => {
        const manageUserProfile = async () => {
            if (!session?.user) {
                setProfile(null);
                setSetupError(null); // Clear error on sign out
                return;
            }

            const { data: userProfile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (userProfile) {
                setProfile(userProfile);
                setSetupError(null); // Clear setup error on success
            } else if (error) {
                // Check for the specific "table not found" error
                if (error.message.includes("does not exist") || error.message.includes("Could not find the table")) {
                    setSetupError("Database setup incomplete: The 'profiles' table is missing. Please run the SQL script from supabaseClient.ts in your Supabase project's SQL Editor.");
                    console.error("CRITICAL SETUP ERROR:", error.message);
                } else if (error.code === 'PGRST116') { // Profile not found, so create it
                    console.warn('No profile found for user, creating one.');
                    const { data: newProfile, error: insertError } = await supabase
                        .from('profiles')
                        .insert({
                            id: session.user.id,
                            full_name: session.user.user_metadata?.full_name || session.user.email,
                            avatar_url: session.user.user_metadata?.avatar_url,
                            phone: session.user.user_metadata?.phone,
                        })
                        .select()
                        .single();
                    
                    if (insertError) {
                        console.error('Error creating profile:', insertError.message);
                        setSetupError("Could not create a user profile. Please check the database permissions.");
                    } else {
                        setProfile(newProfile);
                        setSetupError(null);
                    }
                } else {
                    console.error('Error fetching profile:', error.message);
                    setSetupError("An unexpected error occurred while fetching your profile.");
                }
            }
        };

        manageUserProfile();
    }, [session]);

    useEffect(() => {
        if (loading) return;
        if (setupError) return; // Halt navigation if there's a setup error

        if (session) {
            const shouldRedirect = currentScreen === Screen.SplashScreen || 
                                   (authScreens.includes(currentScreen) && currentScreen !== Screen.SignUpSuccess);
            if (shouldRedirect) {
                setCurrentScreen(Screen.MainMap);
            }
        } else {
            if (!authScreens.includes(currentScreen)) {
                setCurrentScreen(Screen.Login);
            }
        }
    }, [session, loading, currentScreen, setupError]);

    const navigate = (screen: Screen, options?: { fromRideFlow?: boolean }) => {
        if (options?.fromRideFlow) {
            setNavigationOrigin(Screen.MainMap);
        } else {
            setNavigationOrigin(null);
        }
        setCurrentScreen(screen);
    };
    
    const signOut = async () => {
        await supabase.auth.signOut();
        setSetupError(null); // Clear any setup errors on sign out
    }

    const renderScreen = () => {
        if (setupError) return <SetupErrorScreen message={setupError} />;
        if (loading || (session && !profile && !authScreens.includes(currentScreen))) return <SplashScreen />;

        switch (currentScreen) {
            case Screen.SplashScreen: return <SplashScreen />;
            case Screen.Login: return <LoginScreen />;
            case Screen.SignUp: return <SignUpScreen />;
            case Screen.SignUpSuccess: return <SignUpSuccessScreen />;
            case Screen.Profile: return <ProfileScreen />;
            case Screen.History: return <HistoryScreen />;
            case Screen.Payments: return <PaymentsScreen />;
            case Screen.Support: return <SupportScreen />;
            case Screen.ForgotPassword: return <ForgotPasswordScreen />;
            case Screen.Settings: return <SettingsScreen />;
            case Screen.ChangePassword: return <ChangePasswordScreen />;
            case Screen.HelpCenter: return <HelpCenterScreen />;
            case Screen.ContactSupport: return <ContactSupportScreen />;
            case Screen.ReportProblem: return <ReportProblemScreen />;
            case Screen.TermsAndPolicy: return <TermsAndPolicyScreen mode="terms" />;
            case Screen.PrivacyPolicy: return <TermsAndPolicyScreen mode="policy" />;
            case Screen.SearchDestination: return <SearchDestinationScreen />;
            case Screen.MainMap: default: return <MainMapScreen />;
        }
    };

    return (
        <AppContext.Provider value={{ session, user: session?.user, profile, setProfile, signOut, navigate, rideState, setRideState, paymentState, setPaymentState, navigationOrigin }}>
            <div className="w-full h-full overflow-hidden relative font-sans bg-white">
                {renderScreen()}
            </div>
        </AppContext.Provider>
    );
};

export default App;