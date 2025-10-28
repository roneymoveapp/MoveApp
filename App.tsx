import React, { useState, useEffect, createContext, useContext, useRef } from 'react';
import { Screen } from './types';
import { supabase } from './supabaseClient';

// Fix for lines 733, 734, 745: Property 'google' does not exist on type 'Window'.
// This declares 'google' on the window object to satisfy TypeScript.
declare global {
    interface Window {
        google: any;
        gm_authFailure?: boolean;
    }
}

// --- TYPE DEFINITIONS (from Supabase) ---
type Session = any;
type User = any;
type Profile = {
    id: string;
    full_name: string;
    phone?: string | null;
    latitude?: number;
    longitude?: number;
    fcm_token?: string | null;
};
type Ride = {
    id: number;
    from_location: string;
    to_location: string;
    estimated_price: string;
    final_price: string | null;
    created_at: string;
    vehicle_type: string | null;
    user_id: string;
    driver_id: string | null;
    status: 'searching' | 'driver_en_route' | 'in_progress' | 'completed' | 'cancelled';
    rating: number | null;
};
type ScheduledRide = {
    id: number;
    user_id: string;
    from_location: string;
    to_location: string;
    vehicle_type: string;
    scheduled_for: string;
    status: string;
    created_at: string;
};
type Driver = {
    id: string;
    is_active: boolean;
    status: 'offline' | 'online' | 'in_ride';
    current_latitude: number | null;
    current_longitude: number | null;
};

type DriverDetails = {
    full_name: string;
    vehicle_model: string;
    vehicle_color: string | null;
    license_plate: string;
};

interface PaymentMethod {
    id: number;
    type: 'Cartão' | 'Pix' | 'Dinheiro';
    details: string | null;
    is_selected: boolean;
}

type ChatMessage = {
    id: number;
    ride_id: number;
    sender_id: string;
    receiver_id: string;
    message_content: string;
    created_at: string;
};


// --- APP CONTEXT & STATE ---
interface RideState {
    stage: 'none' | 'confirming_details' | 'searching' | 'driver_en_route' | 'in_progress' | 'rating';
    from: string | null;
    to: string | null;
    stops: string[];
    vehicle: 'Simples' | 'Conforto' | null;
    estimatedPrice: string | null;
    rideId: number | null;
    driverId: string | null;
    driverDetails: DriverDetails | null;
}

const initialRideState: RideState = {
    stage: 'none',
    from: null,
    to: null,
    stops: [],
    vehicle: null,
    estimatedPrice: null,
    rideId: null,
    driverId: null,
    driverDetails: null
};

interface AppContextType {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    setProfile: React.Dispatch<React.SetStateAction<Profile | null>>;
    signOut: () => void;
    navigate: (screen: Screen, options?: { fromRideFlow?: boolean }) => void;
    rideState: RideState;
    setRideState: React.Dispatch<React.SetStateAction<RideState>>;
    paymentMethods: PaymentMethod[];
    setPaymentMethods: React.Dispatch<React.SetStateAction<PaymentMethod[]>>;
    refreshPaymentMethods: () => Promise<void>;
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

// --- HELPER FUNCTIONS ---
const getInitials = (name: string | null | undefined): string => {
    if (!name) return '';
    return name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
};


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

const MenuIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-800" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
);

const CheckCircleIcon: React.FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
);

const LocationTargetIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 text-gray-700 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
        <path d="M12 15a3 3 0 1 0-3-3 3 3 0 0 0 3 3z" />
    </svg>
);

const CreditCardIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);

const PixIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
);

const CashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);

const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${className}`} viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
        <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
    </svg>
);

const CarSimpleIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} stroke="none" className={`w-8 h-8 ${className}`}>
        <path d="M19.92,4.62A20.24,20.24,0,0,0,12,2a20.24,20.24,0,0,0-7.92,2.62.5.5,0,0,0-.23.63L6,11H2.5a.5.5,0,0,0-.5.5v3a.5.5,0,0,0,.5.5H6l2.15,7.25a.5.5,0,0,0,.46.38h6.78a.5.5,0,0,0,.46-.38L18,15h3.5a.5.5,0,0,0,.5-.5v-3a.5.5,0,0,0-.5-.5H18L19.75,5.25A.5.5,0,0,0,19.92,4.62ZM8,13,6.88,9h10.24L16,13ZM12,4a18.29,18.29,0,0,1,6.58,2.25L17.13,8H6.87L5.42,6.25A18.29,18.29,0,0,1,12,4Z"/>
    </svg>
);

const CarComfortIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" strokeWidth={1.5} stroke="none" className={`w-8 h-8 ${className}`}>
      <path d="M22.68,8.23,21,4.75A3,3,0,0,0,18.25,3H5.75A3,3,0,0,0,3,4.75L1.32,8.23a3,3,0,0,0,0,2.54L3,14.25A3,3,0,0,0,5.75,16h.25v2.25a.75.75,0,0,0,.75.75h1.5a.75.75,0,0,0,.75-.75V16h5v2.25a.75.75,0,0,0,.75.75h1.5a.75.75,0,0,0,.75-.75V16h.25A3,3,0,0,0,21,14.25l1.68-3.48A3,3,0,0,0,22.68,8.23ZM5.75,4.5h12.5a1.5,1.5,0,0,1,1.38.75l1,2H3.37l1-2A1.5,1.5,0,0,1,5.75,4.5ZM20.32,11.5H3.68L2.3,13.37A1.5,1.5,0,0,0,3.68,14.5h16.64a1.5,1.5,0,0,0,1.38-1.13Z"/>
    </svg>
);

const paymentMethodIcons = {
    'Cartão': CreditCardIcon,
    'Pix': PixIcon,
    'Dinheiro': CashIcon,
};


// --- REUSABLE UI COMPONENTS ---
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
    variant?: 'primary' | 'secondary' | 'social' | 'danger';
}
const Button: React.FC<ButtonProps> = ({ children, variant = 'primary', className = '', ...props }) => {
    const baseClasses = "w-full py-3 font-semibold rounded-lg shadow-md flex items-center justify-center transition";
    const variantClasses = {
        primary: "bg-slate-800 text-white hover:bg-slate-700 disabled:bg-slate-400 disabled:cursor-not-allowed",
        secondary: "bg-gray-200 text-slate-800 hover:bg-gray-300 disabled:bg-gray-300 disabled:cursor-not-allowed",
        social: "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed",
        danger: "bg-red-500 text-white hover:bg-red-600 disabled:bg-red-300",
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


// --- SCREEN COMPONENTS ---

const SplashScreen: React.FC = () => (
    <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center animate-fade-in">
        <Logo />
        <div className="absolute bottom-16 flex space-x-2">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse [animation-delay:-0.3s]"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse [animation-delay:-0.1s]"></div>
            <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
        </div>
    </div>
);

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
        <div className="w-full h-full bg-white flex flex-col items-center justify-center p-8 text-center animate-fade-in">
            <CheckCircleIcon />
            <h2 className="text-3xl font-bold text-slate-800 mt-6">Cadastro realizado!</h2>
            <p className="text-gray-600 mt-2 max-w-sm">
                Enviamos um link de confirmação para o seu e-mail. Por favor, verifique sua caixa de entrada para ativar sua conta.
            </p>
            <div className="mt-8 w-full max-w-xs">
                <Button onClick={() => navigate(Screen.Login)}>
                    Voltar para o Login
                </Button>
            </div>
        </div>
    );
};

const ForgotPasswordScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleSendLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: window.location.origin, // Redirect back to the app
            });
            if (error) throw error;
            setMessage('Se existir uma conta com este e-mail, um link de redefinição de senha foi enviado.');
        } catch (error: any) {
            setError(error.message || 'Falha ao enviar o link.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper title="Esqueci a Senha" onBack={() => navigate(Screen.Login)}>
            <div className="space-y-6">
                <p className="text-gray-600 text-center">
                    Digite seu e-mail abaixo e enviaremos um link para você redefinir sua senha.
                </p>
                {message && <p className="bg-green-100 text-green-700 p-3 rounded-lg text-center animate-fade-in">{message}</p>}
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center animate-fade-in">{error}</p>}
                <form onSubmit={handleSendLink}>
                    <div className="space-y-4">
                        <Input
                            placeholder="Seu e-mail"
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="mt-6">
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Enviando...' : 'Enviar Link'}
                        </Button>
                    </div>
                </form>
            </div>
        </ScreenWrapper>
    );
};

const ResetPasswordScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (password.length < 6) {
             setError('A senha deve ter no mínimo 6 caracteres.');
            return;
        }

        setLoading(true);
        setMessage('');
        setError('');

        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;
            setMessage('Sua senha foi atualizada com sucesso!');
            setTimeout(() => {
                navigate(Screen.Login);
            }, 2000);
        } catch (error: any) {
            setError(error.message || 'Falha ao redefinir a senha.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full bg-white flex flex-col justify-center p-8 animate-fade-in">
             <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-slate-800">Redefinir Senha</h2>
                <p className="text-gray-500 mt-2">Crie uma nova senha para sua conta.</p>
            </div>
            {message && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4 text-center">{message}</p>}
            {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
            <form onSubmit={handleResetPassword} className="space-y-4">
                <Input 
                    placeholder="Nova senha" 
                    type="password" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    required 
                />
                <Input 
                    placeholder="Confirmar nova senha" 
                    type="password" 
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    required 
                />
                <div className="mt-2">
                    <Button type="submit" disabled={loading || !!message}>
                        {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                    </Button>
                </div>
            </form>
        </div>
    );
};

const SearchDestinationScreen: React.FC = () => {
    const { navigate, setRideState } = useAppContext();
    const [fromLocation, setFromLocation] = useState('Buscando endereço atual...');
    const [stops, setStops] = useState<string[]>([]);
    const [toLocation, setToLocation] = useState('');
    
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        const setupAutocomplete = (index: number) => {
            if (window.google && window.google.maps && inputRefs.current[index]) {
                const autocomplete = new window.google.maps.places.Autocomplete(inputRefs.current[index]!, {
                    fields: ["formatted_address", "name"],
                    componentRestrictions: { country: "br" },
                });
                autocomplete.addListener("place_changed", () => {
                    const place = autocomplete.getPlace();
                    if (place.formatted_address) {
                        if (index === 0) {
                            setFromLocation(place.formatted_address);
                        } else if (index === stops.length + 1) {
                            setToLocation(place.formatted_address);
                        } else {
                            const newStops = [...stops];
                            newStops[index - 1] = place.formatted_address;
                            setStops(newStops);
                        }
                    }
                });
            }
        };

        inputRefs.current.forEach((_, index) => setupAutocomplete(index));

    }, [stops.length]);

    useEffect(() => {
        inputRefs.current = inputRefs.current.slice(0, stops.length + 2);
        if (stops.length > 0) {
             setTimeout(() => inputRefs.current[stops.length]?.focus(), 100);
        } else {
             setTimeout(() => inputRefs.current[1]?.focus(), 100);
        }
    }, [stops.length]);

    useEffect(() => {
        const initialize = () => {
             if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                        if (window.google && window.google.maps) {
                            const geocoder = new window.google.maps.Geocoder();
                            geocoder.geocode({ location: userPos }, (results, status) => {
                                if (status === 'OK' && results && results[0]) {
                                    setFromLocation(results[0].formatted_address);
                                } else {
                                    setFromLocation('Endereço atual não encontrado');
                                }
                            });
                        }
                    },
                    () => { setFromLocation('Não foi possível obter a localização'); },
                    { enableHighAccuracy: true }
                );
            } else {
                setFromLocation('Geolocalização não suportada');
            }
        };
         const checkGoogle = () => {
            if (window.google && window.google.maps && window.google.maps.places) {
                initialize();
            } else {
                setTimeout(checkGoogle, 100);
            }
        };
        checkGoogle();
    }, []);

    const addStop = () => {
        if (stops.length < 2) {
            setStops([...stops, '']);
        }
    };

    const removeStop = (index: number) => {
        setStops(stops.filter((_, i) => i !== index));
    };

    const updateStop = (index: number, value: string) => {
        const newStops = [...stops];
        newStops[index] = value;
        setStops(newStops);
    };

    const handleConfirm = () => {
        if (!fromLocation.trim() || !toLocation.trim() || fromLocation === 'Buscando endereço atual...') return;
        setRideState(prevState => ({
            ...prevState,
            stage: 'confirming_details',
            from: fromLocation,
            to: toLocation,
            stops: stops.filter(s => s.trim() !== ''),
        }));
        navigate(Screen.MainMap);
    };

    const allLocations = [fromLocation, ...stops, toLocation];

    return (
        <div className="w-full h-full bg-white flex flex-col animate-fade-in">
            <header className="bg-white p-4 flex items-center flex-shrink-0 z-10 border-b">
                <button onClick={() => navigate(Screen.MainMap)} className="p-2 rounded-full hover:bg-gray-100 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-xl font-semibold text-slate-800">Definir Rota</h2>
            </header>

            <main className="flex-grow p-4">
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <div className="flex">
                        <div className="flex flex-col items-center mr-4">
                            {allLocations.map((_, index) => (
                                <React.Fragment key={index}>
                                    <div className={`w-3 h-3 rounded-full mt-3 ${index === 0 ? 'bg-gray-500' : index === allLocations.length - 1 ? 'bg-blue-500' : 'bg-gray-400 ring-2 ring-gray-200'}`}></div>
                                    {index < allLocations.length - 1 && <div className="w-px flex-grow bg-gray-300 my-2"></div>}
                                </React.Fragment>
                            ))}
                        </div>
                        <div className="flex-grow space-y-4">
                            <Input
                                ref={el => inputRefs.current[0] = el}
                                placeholder="Local de partida"
                                value={fromLocation}
                                onChange={(e) => setFromLocation(e.target.value)}
                            />
                            {stops.map((stop, index) => (
                                <div key={index} className="relative">
                                    <Input
                                        ref={el => inputRefs.current[index + 1] = el}
                                        placeholder={`Parada ${index + 1}`}
                                        value={stop}
                                        onChange={(e) => updateStop(index, e.target.value)}
                                    />
                                    <button onClick={() => removeStop(index)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                            <Input
                                ref={el => inputRefs.current[stops.length + 1] = el}
                                placeholder="Para onde vamos?"
                                value={toLocation}
                                onChange={(e) => setToLocation(e.target.value)}
                            />
                        </div>
                    </div>
                     {stops.length < 2 && (
                        <button onClick={addStop} className="w-full text-left text-sm text-slate-600 font-semibold p-2 mt-3 hover:bg-gray-100 rounded-md">+ Adicionar parada</button>
                    )}
                </div>
            </main>

            <footer className="p-4 border-t bg-white">
                <Button onClick={handleConfirm} disabled={!toLocation.trim() || !fromLocation.trim() || fromLocation === 'Buscando endereço atual...'}>
                    Confirmar Rota
                </Button>
            </footer>
        </div>
    );
};

const ProfileScreen: React.FC = () => {
    const { navigate, profile, user, setProfile } = useAppContext();
    const [isEditing, setIsEditing] = useState(false);
    const [fullName, setFullName] = useState(profile?.full_name || '');
    const [phone, setPhone] = useState(profile?.phone || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Sync local state if profile from context changes
    useEffect(() => {
        if (profile) {
            setFullName(profile.full_name || '');
            setPhone(profile.phone || '');
        }
    }, [profile]);

    const handleEditToggle = () => {
        setIsEditing(!isEditing);
        setError(null);
        setSuccess(null);
        // If canceling, reset fields to original profile data
        if (isEditing && profile) {
            setFullName(profile.full_name || '');
            setPhone(profile.phone || '');
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ full_name: fullName, phone })
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;
            
            // Update global profile state
            if (data) {
                setProfile(data as Profile);
            }
            
            setSuccess('Perfil atualizado com sucesso!');
            setIsEditing(false);
            setTimeout(() => setSuccess(null), 3000); // Clear message after 3 seconds

        } catch (error: any) {
            setError(error.message || 'Falha ao atualizar o perfil.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper title="Meu Perfil" onBack={() => navigate(Screen.MainMap)}>
            <div className="flex flex-col items-center">
                 {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center w-full animate-fade-in">{error}</p>}
                 {success && <p className="bg-green-100 text-green-700 p-3 rounded-lg mb-4 text-center w-full animate-fade-in">{success}</p>}
                <div className="relative mb-6">
                    <div className="w-28 h-28 bg-red-500 rounded-full flex items-center justify-center text-white text-4xl font-bold">
                        {getInitials(isEditing ? fullName : profile?.full_name)}
                    </div>
                    <button onClick={handleEditToggle} className="absolute bottom-0 right-0 bg-slate-800 text-white p-2 rounded-full border-2 border-gray-50 hover:bg-slate-700 transition">
                        <EditIcon />
                    </button>
                </div>
                
                <div className="w-full space-y-4">
                    <div>
                        <label className="text-sm font-medium text-gray-500">Nome completo</label>
                        <Input 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)}
                            disabled={!isEditing} 
                        />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">E-mail</label>
                        <Input value={user?.email || ''} readOnly disabled />
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-500">Número de celular</label>
                        <Input 
                            value={phone || ''}
                            onChange={(e) => setPhone(e.target.value)}
                            disabled={!isEditing}
                        />
                    </div>
                </div>

                <div className="w-full space-y-3 mt-8">
                     <Button variant="secondary" onClick={() => navigate(Screen.ChangePassword)}>Alterar senha</Button>
                     {isEditing ? (
                         <div className="flex space-x-3">
                            <Button variant="secondary" onClick={handleEditToggle} disabled={loading}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={loading}>
                                {loading ? 'Salvando...' : 'Salvar'}
                            </Button>
                         </div>
                     ) : (
                        <Button onClick={handleEditToggle}>Editar Perfil</Button>
                     )}
                </div>
            </div>
        </ScreenWrapper>
    );
};

const HistoryScreen: React.FC = () => {
    const { navigate, user } = useAppContext();
    const [rides, setRides] = useState<Ride[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchRides = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('rides')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                
                if (data) setRides(data as Ride[]);

            } catch (error: any) {
                setError('Erro ao carregar o histórico de corridas.');
                console.error('Error fetching rides:', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchRides();
    }, [user]);

    const RideCard: React.FC<{ ride: Ride }> = ({ ride }) => {
        const rideDate = new Date(ride.created_at).toLocaleDateString('pt-BR', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const ridePrice = ride.final_price ? `R$ ${ride.final_price.replace('.', ',')}` : `~R$ ${ride.estimated_price.replace('.',',')}`;

        return (
            <div className="bg-white rounded-lg shadow p-4 mb-4 animate-fade-in">
                <div className="flex justify-between items-start pb-3 border-b border-gray-100">
                    <div>
                        <p className="text-sm text-gray-500">{rideDate}</p>
                        <p className="font-semibold text-xl text-slate-800">{ridePrice}</p>
                    </div>
                    <div className="flex items-center space-x-2 bg-gray-100 px-3 py-1 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                         </svg>
                         <span className="text-sm font-medium text-gray-700">{ride.vehicle_type || 'Simples'}</span>
                    </div>
                </div>
                <div className="pt-4 space-y-2">
                     <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white ring-2 ring-green-200"></div>
                        <p className="text-gray-700 flex-1">{ride.from_location}</p>
                     </div>
                      <div className="h-4 border-l-2 border-dotted border-gray-300 ml-[5px]"></div>
                     <div className="flex items-center space-x-3">
                         <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white ring-2 ring-red-200"></div>
                         <p className="text-gray-700 flex-1">{ride.to_location}</p>
                     </div>
                </div>
            </div>
        );
    }

    const renderContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500 text-lg animate-pulse">Carregando histórico...</p>
                </div>
            );
        }

        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                     </svg>
                    <p className="text-red-500 font-semibold">{error}</p>
                </div>
            );
        }

        if (rides.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500 text-lg font-medium">Nenhuma corrida encontrada.</p>
                    <p className="text-gray-400 text-sm">Seu histórico de corridas aparecerá aqui.</p>
                </div>
            );
        }

        return (
            <div>
                {rides.map(ride => <RideCard key={ride.id} ride={ride} />)}
            </div>
        );
    };

    return (
        <ScreenWrapper title="Histórico de Corridas" onBack={() => navigate(Screen.MainMap)}>
            {renderContent()}
        </ScreenWrapper>
    );
};

const AddCardScreen: React.FC = () => {
    const { navigate, user, refreshPaymentMethods } = useAppContext();
    const [cardNumber, setCardNumber] = useState('');
    const [cardName, setCardName] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvv, setCvv] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, ''); // Remove non-digits
        const formattedValue = value.replace(/(\d{4})/g, '$1 ').trim(); // Add space every 4 digits
        if (formattedValue.length <= 19) {
            setCardNumber(formattedValue);
        }
    };

    const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 2) {
            value = value.slice(0, 2) + '/' + value.slice(2);
        }
        if (value.length <= 5) {
            setExpiryDate(value);
        }
    };
    
    const handleCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, '');
        if (value.length <= 4) {
            setCvv(value);
        }
    };

    const handleSave = async () => {
        setError(null);
        if (!cardNumber || !cardName || !expiryDate || !cvv) {
            setError('Por favor, preencha todos os campos.');
            return;
        }
        const unformattedCardNumber = cardNumber.replace(/\s/g, '');
        if (unformattedCardNumber.length < 16) {
            setError('Número do cartão inválido.');
            return;
        }
        if (expiryDate.length < 5) {
            setError('Data de validade inválida.');
            return;
        }

        if (!user) {
            setError('Usuário não autenticado. Por favor, faça login novamente.');
            return;
        }

        setLoading(true);
        
        try {
            // Desmarcar qualquer outro método como selecionado
            const { error: updateError } = await supabase
                .from('payment_methods')
                .update({ is_selected: false })
                .eq('user_id', user.id);

            if (updateError) throw updateError;
            
            // Inserir o novo cartão como selecionado
            const { error: insertError } = await supabase.from('payment_methods').insert({
                user_id: user.id,
                type: 'Cartão',
                details: `Cartão final ${unformattedCardNumber.slice(-4)}`,
                is_selected: true,
            });

            if (insertError) throw insertError;

            // Atualizar o estado global e navegar de volta
            await refreshPaymentMethods();
            navigate(Screen.Payments);

        } catch (error: any) {
            setError(error.message || "Falha ao salvar o cartão.");
            console.error('Save card error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper title="Adicionar Cartão" onBack={() => navigate(Screen.Payments)}>
            <div className="space-y-6">
                {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg text-center animate-fade-in">{error}</p>}
                <div>
                    <label className="text-sm font-medium text-gray-500">Número do Cartão</label>
                    <Input placeholder="0000 0000 0000 0000" value={cardNumber} onChange={handleCardNumberChange} />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-500">Nome no Cartão</label>
                    <Input placeholder="Seu nome completo" value={cardName} onChange={(e) => setCardName(e.target.value)} />
                </div>
                <div className="flex space-x-4">
                    <div className="w-1/2">
                        <label className="text-sm font-medium text-gray-500">Validade</label>
                        <Input placeholder="MM/AA" value={expiryDate} onChange={handleExpiryDateChange} />
                    </div>
                    <div className="w-1/2">
                        <label className="text-sm font-medium text-gray-500">CVV</label>
                        <Input placeholder="123" type="password" value={cvv} onChange={handleCvvChange} />
                    </div>
                </div>
                 <div className="pt-4">
                    <Button onClick={handleSave} disabled={loading}>
                        {loading ? 'Salvando...' : 'Salvar Cartão'}
                    </Button>
                </div>
            </div>
        </ScreenWrapper>
    );
};

const PaymentsScreen: React.FC = () => {
    const { navigate, paymentMethods, user, refreshPaymentMethods } = useAppContext();
    const [loadingSelection, setLoadingSelection] = useState<string | null>(null);

    const handleSelect = async (methodOrType: { type: 'Pix' | 'Dinheiro' } | PaymentMethod) => {
        if (!user) return;
        
        const selectionKey = 'id' in methodOrType ? `card-${methodOrType.id}` : methodOrType.type;
        setLoadingSelection(selectionKey);

        try {
            // 1. Desmarcar todos os métodos existentes
            await supabase.from('payment_methods').update({ is_selected: false }).eq('user_id', user.id);

            // 2. Selecionar o método clicado
            if ('id' in methodOrType) { // É um cartão salvo
                await supabase.from('payment_methods').update({ is_selected: true }).eq('id', methodOrType.id);
            } else { // É Pix ou Dinheiro
                const { data } = await supabase
                    .from('payment_methods')
                    .select('id')
                    .match({ user_id: user.id, type: methodOrType.type })
                    .single();

                if (data) { // Já existe, apenas atualiza
                    await supabase.from('payment_methods').update({ is_selected: true }).eq('id', data.id);
                } else { // Não existe, insere um novo
                    await supabase.from('payment_methods').insert({
                        user_id: user.id,
                        type: methodOrType.type,
                        details: methodOrType.type, // 'Pix' ou 'Dinheiro'
                        is_selected: true
                    });
                }
            }
            await refreshPaymentMethods();
        } catch (error: any) {
            console.error("Failed to select payment method:", error.message);
        } finally {
            setLoadingSelection(null);
        }
    };
    
    const savedCards = paymentMethods.filter(p => p.type === 'Cartão');
    const selectedMethod = paymentMethods.find(p => p.is_selected);

    const renderPaymentListItem = (
        name: string,
        icon: React.ReactNode,
        onClick: () => void,
        isClickable: boolean,
        isSelected: boolean,
        isLoading: boolean
    ) => (
        <li
            onClick={isClickable && !isLoading ? onClick : undefined}
            className={`p-4 flex items-center justify-between ${isClickable ? 'cursor-pointer hover:bg-gray-50' : ''} ${isSelected ? 'bg-slate-100' : ''}`}
        >
            <div className="flex items-center space-x-4">
                {icon}
                <span className="flex-grow text-gray-800">{name}</span>
            </div>
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
            ) : isClickable && (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
            )}
        </li>
    );

    return (
        <ScreenWrapper title="Pagamentos" onBack={() => navigate(Screen.MainMap)}>
            <div className="space-y-8">
                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Forma de Pagamento</h3>
                    <div className="bg-white rounded-lg shadow">
                         {selectedMethod ? (
                             <div className="p-4 flex items-center space-x-4">
                                {React.createElement(paymentMethodIcons[selectedMethod.type], { className: "text-gray-600" })}
                                <span className="flex-grow text-gray-800 font-medium">{selectedMethod.details || selectedMethod.type}</span>
                             </div>
                         ) : (
                            <div className="p-4 text-center text-gray-500">
                                Nenhuma forma de pagamento selecionada.
                            </div>
                        )}
                    </div>
                </div>

                <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Escolha uma opção</h3>
                    <div className="bg-white rounded-lg shadow">
                        <ul className="divide-y divide-gray-200">
                            {/* Lista de cartões salvos */}
                            {savedCards.map(card => renderPaymentListItem(
                                card.details || 'Cartão',
                                <CreditCardIcon className="text-gray-600" />,
                                () => handleSelect(card),
                                true,
                                card.is_selected,
                                loadingSelection === `card-${card.id}`
                            ))}
                            {/* Opção para adicionar novo cartão */}
                            {renderPaymentListItem(
                                'Cartão de crédito ou débito',
                                <CreditCardIcon className="text-gray-600" />,
                                () => navigate(Screen.AddCard),
                                true,
                                false,
                                false
                            )}
                            {/* Opção Pix */}
                            {renderPaymentListItem(
                                'Pix',
                                <PixIcon className="text-green-500" />,
                                () => handleSelect({ type: 'Pix' }),
                                true,
                                selectedMethod?.type === 'Pix',
                                loadingSelection === 'Pix'
                            )}
                             {/* Opção Dinheiro */}
                             {renderPaymentListItem(
                                'Dinheiro',
                                <CashIcon className="text-blue-500" />,
                                () => handleSelect({ type: 'Dinheiro' }),
                                true,
                                selectedMethod?.type === 'Dinheiro',
                                loadingSelection === 'Dinheiro'
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        </ScreenWrapper>
    );
};


const SupportScreen: React.FC = () => {
    const { navigate } = useAppContext();
    const supportOptions = [
        { name: 'Central de Ajuda', screen: Screen.HelpCenter },
        { name: 'Falar com o Suporte', screen: Screen.ContactSupport },
        { name: 'Relatar Problema com Corrida', screen: Screen.ReportProblem },
    ];

    return (
        <ScreenWrapper title="Suporte" onBack={() => navigate(Screen.MainMap)}>
             <div className="bg-white rounded-lg shadow">
                <ul className="divide-y divide-gray-200">
                    {supportOptions.map(option => (
                        <li key={option.name} onClick={() => navigate(option.screen)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50">
                            <span className="text-gray-800">{option.name}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </li>
                    ))}
                </ul>
            </div>
        </ScreenWrapper>
    );
};

const SettingsScreen: React.FC = () => {
    const { navigate, profile, user, setProfile } = useAppContext();
    const [notificationsEnabled, setNotificationsEnabled] = useState(!!profile?.fcm_token);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setNotificationsEnabled(!!profile?.fcm_token);
    }, [profile]);
    
    const handleToggleNotifications = async () => {
        if (!user || !profile) return;
        setLoading(true);

        try {
            if (notificationsEnabled) { // User wants to disable
                await supabase.from('profiles').update({ fcm_token: null }).eq('id', user.id);
                setProfile({ ...profile, fcm_token: null });
                setNotificationsEnabled(false);
            } else { // User wants to enable
                if (window.confirm('Deseja permitir que o Move envie notificações para você?')) {
                    const fakeToken = `fake-fcm-token-${Date.now()}`;
                    await supabase.from('profiles').update({ fcm_token: fakeToken }).eq('id', user.id);
                    setProfile({ ...profile, fcm_token: fakeToken });
                    setNotificationsEnabled(true);
                }
            }
        } catch (error) {
            console.error('Failed to update notification settings', error);
            alert('Não foi possível alterar a configuração de notificação.');
        } finally {
            setLoading(false);
        }
    };


    return (
        <ScreenWrapper title="Configurações" onBack={() => navigate(Screen.MainMap)}>
            <div className="space-y-6">
                 <div className="bg-white rounded-lg shadow">
                    <div className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-gray-800">Notificações</p>
                            <p className="text-sm text-gray-500">Receber alertas de corridas e promoções.</p>
                        </div>
                        <button
                            onClick={handleToggleNotifications}
                            disabled={loading}
                            className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 ${notificationsEnabled ? 'bg-slate-800' : 'bg-gray-200'} disabled:opacity-50`}
                        >
                            <span
                                className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform duration-200 ease-in-out ${notificationsEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                            />
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow">
                    <ul className="divide-y divide-gray-200">
                        <li className="p-4 flex items-center justify-between">
                            <span className="text-gray-800">Versão do Aplicativo</span>
                            <span className="text-gray-500">1.0.0</span>
                        </li>
                         <li onClick={() => navigate(Screen.TermsAndPolicy)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50">
                            <span className="text-gray-800">Termos de Uso</span>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </li>
                         <li onClick={() => navigate(Screen.PrivacyPolicy)} className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50">
                            <span className="text-gray-800">Política de Privacidade</span>
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </li>
                    </ul>
                </div>
            </div>
        </ScreenWrapper>
    );
};

const ChangePasswordScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return <ScreenWrapper title="Alterar Senha" onBack={() => navigate(Screen.Profile)}><p>Tela de Alterar Senha</p></ScreenWrapper>;
}
const HelpCenterScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return <ScreenWrapper title="Central de Ajuda" onBack={() => navigate(Screen.Support)}><p>Tela da Central de Ajuda</p></ScreenWrapper>;
}
const ContactSupportScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return <ScreenWrapper title="Falar com o Suporte" onBack={() => navigate(Screen.Support)}><p>Tela de Contato com o Suporte</p></ScreenWrapper>;
}
const ReportProblemScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return <ScreenWrapper title="Relatar Problema" onBack={() => navigate(Screen.Support)}><p>Tela de Relatar Problema</p></ScreenWrapper>;
}
const TermsAndPolicyScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return <ScreenWrapper title="Termos de Uso" onBack={() => navigate(Screen.Settings)}><p>Tela de Termos de Uso</p></ScreenWrapper>;
}
const PrivacyPolicyScreen: React.FC = () => {
    const { navigate } = useAppContext();
    return <ScreenWrapper title="Política de Privacidade" onBack={() => navigate(Screen.Settings)}><p>Tela de Política de Privacidade</p></ScreenWrapper>;
}

const ScheduledRidesScreen: React.FC = () => {
    const { navigate, user } = useAppContext();
    const [scheduledRides, setScheduledRides] = useState<ScheduledRide[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchScheduledRides = async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('scheduled_rides')
                .select('*')
                .eq('user_id', user.id)
                .order('scheduled_for', { ascending: true });

            if (error) throw error;
            if (data) setScheduledRides(data as ScheduledRide[]);
        } catch (e: any) {
            setError('Falha ao buscar corridas agendadas.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchScheduledRides();
    }, [user]);

    const handleCancelRide = async (rideId: number) => {
        if (window.confirm('Tem certeza que deseja cancelar esta corrida agendada?')) {
            try {
                const { error } = await supabase.from('scheduled_rides').delete().eq('id', rideId);
                if (error) throw error;
                fetchScheduledRides(); // Refresh the list
            } catch (e) {
                alert('Não foi possível cancelar a corrida.');
            }
        }
    };

    const renderContent = () => {
        if (loading) return <p className="text-center text-gray-500 animate-pulse">Carregando...</p>;
        if (error) return <p className="text-center text-red-500">{error}</p>;
        if (scheduledRides.length === 0) {
            return (
                <div className="text-center text-gray-500 mt-10">
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <p className="mt-2 font-medium">Nenhuma corrida agendada</p>
                    <p className="text-sm">Suas viagens futuras aparecerão aqui.</p>
                </div>
            );
        }
        return (
            <div className="space-y-4">
                {scheduledRides.map(ride => (
                    <div key={ride.id} className="bg-white p-4 rounded-lg shadow">
                        <div className="flex justify-between items-start">
                             <div>
                                <p className="font-bold text-slate-800">
                                    {new Date(ride.scheduled_for).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' })}
                                </p>
                                <p className="text-lg text-slate-600 font-semibold">
                                     {new Date(ride.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </p>
                             </div>
                              <button onClick={() => handleCancelRide(ride.id)} className="text-sm text-red-500 hover:text-red-700">Cancelar</button>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                             <p className="text-sm text-gray-600 truncate"><b>De:</b> {ride.from_location}</p>
                             <p className="text-sm text-gray-600 truncate"><b>Para:</b> {ride.to_location}</p>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <ScreenWrapper title="Corridas Agendadas" onBack={() => navigate(Screen.MainMap)}>
            {renderContent()}
        </ScreenWrapper>
    );
}

const ChatScreen: React.FC = () => {
    const { navigate, rideState, user } = useAppContext();
    const { rideId, driverId, driverDetails } = rideState;
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const fetchMessages = async () => {
            if (!rideId) return;
            try {
                setLoading(true);
                const { data, error } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('ride_id', rideId)
                    .order('created_at', { ascending: true });
                if (error) throw error;
                setMessages(data as ChatMessage[]);
            } catch (e: any) {
                console.error('Failed to fetch messages:', e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchMessages();
    }, [rideId]);

    useEffect(() => {
        const channel = supabase
            .channel(`chat:ride_id=eq.${rideId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages',
                    filter: `ride_id=eq.${rideId}`
                },
                (payload) => {
                    setMessages(prev => [...prev, payload.new as ChatMessage]);
                }
            )
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [rideId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !user || !rideId || !driverId) return;

        const messageContent = newMessage.trim();
        setNewMessage('');

        try {
            const { error } = await supabase.from('chat_messages').insert({
                ride_id: rideId,
                sender_id: user.id,
                receiver_id: driverId,
                message_content: messageContent,
            });
            if (error) throw error;
        } catch (e: any) {
            console.error("Failed to send message:", e.message);
            // Optionally, handle the UI to show the message failed to send
        }
    };

    return (
        <div className="w-full h-full bg-gray-50 flex flex-col animate-fade-in">
            <header className="bg-white shadow-sm p-4 flex items-center flex-shrink-0 z-10">
                <button onClick={() => navigate(Screen.MainMap)} className="p-2 rounded-full hover:bg-gray-100 mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
                <h2 className="text-xl font-semibold text-slate-800">
                    {driverDetails ? `Chat com ${driverDetails.full_name.split(' ')[0]}` : 'Chat'}
                </h2>
            </header>
            <main className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading && <p className="text-center text-gray-500">Carregando mensagens...</p>}
                {!loading && messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                            msg.sender_id === user?.id 
                                ? 'bg-slate-800 text-white rounded-br-none' 
                                : 'bg-white text-gray-800 shadow-sm rounded-bl-none'
                        }`}>
                            <p>{msg.message_content}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </main>
            <footer className="p-4 bg-white border-t">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                    <Input 
                        placeholder="Digite sua mensagem..." 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                    />
                    <button type="submit" className="p-3 bg-slate-800 text-white rounded-lg shadow-md hover:bg-slate-700 transition disabled:bg-slate-400" disabled={!newMessage.trim()}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </form>
            </footer>
        </div>
    );
};


const SideMenu: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { profile, navigate, signOut } = useAppContext();

    const menuItems = [
        { label: 'Perfil', screen: Screen.Profile },
        { label: 'Histórico de Corridas', screen: Screen.History },
        { label: 'Corridas Agendadas', screen: Screen.ScheduledRides },
        { label: 'Pagamentos', screen: Screen.Payments },
        { label: 'Suporte', screen: Screen.Support },
        { label: 'Configurações', screen: Screen.Settings },
    ];

    const handleNavigate = (screen: Screen) => {
        navigate(screen);
        onClose();
    };
    
    const handleSignOut = () => {
        signOut();
        onClose();
    }

    return (
        <>
            {/* Overlay */}
            <div 
                className={`absolute inset-0 bg-black z-40 transition-opacity duration-300 ease-in-out ${isOpen ? 'bg-opacity-50' : 'bg-opacity-0 pointer-events-none'}`} 
                onClick={onClose}
            ></div>
            {/* Menu Panel */}
            <div className={`absolute top-0 left-0 h-full bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{width: '80%'}}>
                <header className="bg-slate-800 p-5 flex items-center space-x-4">
                    <div className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                        {getInitials(profile?.full_name)}
                    </div>
                    <div>
                        <p className="text-white font-semibold text-lg">{profile?.full_name || 'Usuário'}</p>
                    </div>
                </header>
                <nav className="flex-grow py-4">
                    <ul>
                        {menuItems.map(item => (
                            <li key={item.label}>
                                <a
                                    onClick={() => handleNavigate(item.screen)}
                                    className="block px-5 py-3 text-slate-700 hover:bg-gray-100 cursor-pointer text-lg"
                                >
                                    {item.label}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
                <footer className="p-5 border-t border-gray-200">
                     <a
                        onClick={handleSignOut}
                        className="block text-red-500 hover:text-red-700 cursor-pointer text-lg"
                    >
                        Sair
                    </a>
                </footer>
            </div>
        </>
    );
};

const VehicleOption: React.FC<{ type: string; price: string; eta: string; isSelected: boolean; onClick: () => void; }> = 
({ type, price, eta, isSelected, onClick }) => {
    return (
        <div 
            onClick={onClick}
            className={`flex-1 p-3 rounded-lg cursor-pointer border-2 transition ${isSelected ? 'border-slate-800 bg-slate-50' : 'border-transparent bg-gray-100 hover:bg-gray-200'}`}
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="font-bold text-lg">{type}</p>
                    <p className="text-gray-600 font-medium">{price}</p>
                </div>
                {type === 'Simples' ? <CarSimpleIcon className="text-slate-800" /> : <CarComfortIcon className="text-slate-800" />}
            </div>
             <p className="text-sm text-green-600 font-semibold mt-1">Chegada em {eta}</p>
        </div>
    )
};

const RideRequestSheet = () => {
    const { rideState, setRideState, paymentMethods, navigate, user } = useAppContext();
    const [selectedVehicle, setSelectedVehicle] = useState<'Simples' | 'Conforto'>('Simples');
    const [isScheduling, setIsScheduling] = useState(false);
    const [scheduleTime, setScheduleTime] = useState('');

    const prices = {
        Simples: 'R$ 24,50',
        Conforto: 'R$ 31,80'
    };
    
    const resetRideState = () => {
        setRideState(initialRideState);
    };

    const handleConfirmRide = async () => {
        if (!user || !rideState.from || !rideState.to) {
            alert('Erro: não foi possível confirmar a corrida. Tente novamente.');
            return;
        }
        
        const priceAsNumber = parseFloat(prices[selectedVehicle].replace('R$ ', '').replace(',', '.'));

        setRideState(prev => ({
            ...prev,
            stage: 'searching',
            vehicle: selectedVehicle,
            estimatedPrice: prices[selectedVehicle],
        }));

        try {
            const { data, error } = await supabase.rpc('request_ride', {
                p_user_id: user.id,
                p_from_location: rideState.from,
                p_to_location: rideState.to,
                p_price: priceAsNumber,
                p_vehicle_type: selectedVehicle,
            });

            if (error) throw error;
            
            const newRideId = data[0].ride_id;
            
            if (rideState.stops.length > 0) {
                const stopInsertions = rideState.stops.map((stop, index) => ({
                    ride_id: newRideId,
                    location: stop,
                    stop_order: index + 1
                }));
                await supabase.from('ride_stops').insert(stopInsertions);
            }

            setRideState(prev => ({ ...prev, rideId: newRideId }));

        } catch (error: any) {
            console.error('Error requesting ride:', error.message);
            alert('Ocorreu um erro ao solicitar sua corrida. Por favor, tente novamente.');
            setRideState(prev => ({ ...prev, stage: 'confirming_details' }));
        }
    };
    
    const handleScheduleRide = async () => {
        if (!user || !rideState.from || !rideState.to || !scheduleTime) {
            alert('Por favor, selecione uma data e hora para o agendamento.');
            return;
        }

        try {
            const { error } = await supabase.from('scheduled_rides').insert({
                user_id: user.id,
                from_location: rideState.from,
                to_location: rideState.to, // Note: stops are not saved for scheduled rides in this version
                vehicle_type: selectedVehicle,
                scheduled_for: scheduleTime
            });

            if (error) throw error;
            
            alert('Viagem agendada com sucesso!');
            resetRideState();
            setIsScheduling(false);

        } catch(e: any) {
            console.error('Error scheduling ride:', e.message);
            alert('Não foi possível agendar sua viagem. Tente novamente.');
        }
    };

    const handleCancelSearch = async () => {
        if (!rideState.rideId) {
             resetRideState();
             return;
        }
        try {
            await supabase.rpc('cancel_ride', { p_ride_id: rideState.rideId });
            resetRideState();
        } catch(e) {
            console.error('Failed to cancel ride search:', e);
            alert('Falha ao cancelar a busca.');
            // Still reset locally
            resetRideState();
        }
    };


    const currentPayment = paymentMethods.find(p => p.is_selected) || null;
    const CurrentPaymentIcon = currentPayment ? paymentMethodIcons[currentPayment.type] : null;

    const renderContent = () => {
        if (rideState.stage === 'searching') {
            return (
                 <div className="p-6 text-center">
                    <h2 className="text-2xl font-bold mb-4">Procurando motorista...</h2>
                    <div className="flex justify-center items-center space-x-2">
                        <div className="w-4 h-4 bg-slate-800 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                        <div className="w-4 h-4 bg-slate-800 rounded-full animate-pulse [animation-delay:-0.1s]"></div>
                        <div className="w-4 h-4 bg-slate-800 rounded-full animate-pulse"></div>
                    </div>
                    <Button variant="danger" className="mt-8" onClick={handleCancelSearch}>Cancelar Busca</Button>
                </div>
            )
        }

        if (isScheduling) {
            return (
                <div className="p-6 space-y-4">
                     <h2 className="text-2xl font-bold text-center">Agendar Viagem</h2>
                     <p className="text-center text-gray-500 text-sm">Selecione a data e a hora da sua viagem.</p>
                     <Input type="datetime-local" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} />
                     <div className="flex space-x-3">
                        <Button variant="secondary" onClick={() => setIsScheduling(false)}>Cancelar</Button>
                        <Button onClick={handleScheduleRide}>Agendar</Button>
                     </div>
                </div>
            )
        }

        return (
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Escolha sua viagem</h2>
                    <button onClick={resetRideState} className="p-2 rounded-full hover:bg-gray-200">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="flex space-x-3">
                    <VehicleOption 
                        type="Simples"
                        price={prices.Simples}
                        eta="3 min"
                        isSelected={selectedVehicle === 'Simples'}
                        onClick={() => setSelectedVehicle('Simples')}
                    />
                     <VehicleOption 
                        type="Conforto"
                        price={prices.Conforto}
                        eta="5 min"
                        isSelected={selectedVehicle === 'Conforto'}
                        onClick={() => setSelectedVehicle('Conforto')}
                    />
                </div>
                
                <div className="flex items-center justify-between bg-gray-100 p-3 rounded-lg">
                    {currentPayment && CurrentPaymentIcon ? (
                        <>
                            <div className="flex items-center space-x-3">
                                <CurrentPaymentIcon className="text-gray-600"/>
                                <span className="font-medium">{currentPayment.details || currentPayment.type}</span>
                            </div>
                            <button onClick={() => navigate(Screen.Payments)} className="text-slate-600 font-semibold text-sm">Alterar</button>
                        </>
                    ) : (
                         <div className="flex items-center justify-center w-full">
                            <button onClick={() => navigate(Screen.Payments)} className="text-slate-600 font-semibold text-sm">Adicionar Pagamento</button>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-2">
                    <Button onClick={handleConfirmRide} disabled={!currentPayment} className="flex-grow">
                        Confirmar {selectedVehicle}
                    </Button>
                    <button onClick={() => setIsScheduling(true)} className="p-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition" aria-label="Agendar viagem">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </button>
                </div>

            </div>
        )
    };
    
    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-20 animate-slide-in-up">
           {renderContent()}
        </div>
    );
};

const RideStatusSheet = () => {
    const { rideState, setRideState, navigate } = useAppContext();

    const handleCancelRide = async () => {
        if (!rideState.rideId) return;
        if (!confirm('Tem certeza que deseja cancelar a corrida? Pode haver uma taxa de cancelamento.')) return;
        
        try {
            const { data, error } = await supabase.rpc('cancel_ride', { p_ride_id: rideState.rideId });
            if (error) throw error;
            alert(data);
            setRideState(initialRideState);
        } catch(e: any) {
            alert('Falha ao cancelar a corrida.');
            console.error(e);
        }
    };

    const { driverDetails } = rideState;

    const titles = {
        driver_en_route: `Seu motorista está a caminho`,
        in_progress: `Viagem com ${driverDetails?.full_name.split(' ')[0]}`
    }

    const currentTitle = rideState.stage === 'driver_en_route' || rideState.stage === 'in_progress' ? titles[rideState.stage] : "Carregando...";

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-20 animate-slide-in-up p-6 space-y-4">
            {!driverDetails ? (
                <div className="text-center">
                     <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                     <p className="text-gray-600">Buscando dados do motorista...</p>
                </div>
            ) : (
                <>
                    <div className="text-center">
                        <h2 className="text-2xl font-bold">{currentTitle}</h2>
                        <p className="text-gray-600">{rideState.estimatedPrice}</p>
                    </div>

                    <div className="bg-gray-100 p-3 rounded-lg flex items-center justify-between">
                         <div className="text-center">
                             <p className="text-sm text-gray-500">Modelo</p>
                             <p className="font-semibold">{driverDetails.vehicle_model}</p>
                         </div>
                         <div className="text-center">
                             <p className="text-sm text-gray-500">Cor</p>
                             <p className="font-semibold">{driverDetails.vehicle_color || '-'}</p>
                         </div>
                         <div className="text-center bg-white border px-2 py-1 rounded">
                             <p className="text-sm text-gray-500">Placa</p>
                             <p className="font-bold tracking-wider">{driverDetails.license_plate}</p>
                         </div>
                    </div>
                </>
            )}
            <div className="flex items-center space-x-3">
                 <Button variant="secondary" onClick={() => navigate(Screen.Chat)}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" />
                    </svg>
                    Conversar
                 </Button>
                <Button variant="danger" onClick={handleCancelRide} className="flex-1">
                    Cancelar Corrida
                </Button>
            </div>
        </div>
    );
};

const RatingSheet: React.FC = () => {
    const { rideState, setRideState } = useAppContext();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [loading, setLoading] = useState(false);
    
    const handleSubmitRating = async () => {
        if (rating === 0 || !rideState.rideId) return;
        setLoading(true);
        try {
            const { error } = await supabase
                .from('rides')
                .update({ rating: rating })
                .eq('id', rideState.rideId)

            if (error) throw error;
            
            // Success, reset the app state
            alert('Obrigado pela sua avaliação!');

        } catch (e: any) {
            console.error('Failed to submit rating', e);
            alert('Não foi possível enviar sua avaliação.');
        } finally {
            setLoading(false);
            // Reset ride state regardless of success/failure
             setRideState(initialRideState);
        }
    };

    return (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-20 animate-slide-in-up p-6 text-center space-y-4">
             <h2 className="text-2xl font-bold">Avalie sua viagem</h2>
             <p className="text-gray-600">Sua opinião nos ajuda a melhorar.</p>
             <div className="flex justify-center items-center space-x-2 my-4">
                {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                        key={star}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className={`w-10 h-10 cursor-pointer transition-colors ${(hoverRating || rating) >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                ))}
            </div>
            <Button onClick={handleSubmitRating} disabled={loading || rating === 0}>
                {loading ? 'Enviando...' : 'Enviar Avaliação'}
            </Button>
        </div>
    );
};


const MainMapScreen: React.FC = () => {
    const { navigate, rideState, setRideState } = useAppContext();
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const userMarker = useRef<any>(null);
    const directionsRenderer = useRef<any>(null);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [mapLoadError, setMapLoadError] = useState(false);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const driverMarkers = useRef<Map<string, any>>(new Map());

    const defaultCenter = { lat: -23.55052, lng: -46.633308 }; // São Paulo

    const centerMap = (position: { lat: number; lng: number }) => {
        if (mapInstance.current) {
            mapInstance.current.setCenter(position);
            mapInstance.current.setZoom(15);
            if (userMarker.current) {
                userMarker.current.setPosition(position);
            } else {
                userMarker.current = new window.google.maps.Marker({
                    position,
                    map: mapInstance.current,
                    icon: {
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: 8,
                        fillColor: "#4285F4",
                        fillOpacity: 1,
                        strokeColor: "white",
                        strokeWeight: 2,
                    },
                });
            }
        }
    };

    useEffect(() => {
        if (mapRef.current && !mapInstance.current) {
            if (window.google && window.google.maps) {
                // Initialize map
                mapInstance.current = new window.google.maps.Map(mapRef.current, {
                    center: defaultCenter,
                    zoom: 12,
                    disableDefaultUI: true,
                    styles: [
                        { elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
                        { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
                        { elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
                        { elementType: "labels.text.stroke", stylers: [{ color: "#f5f5f5" }] },
                        { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
                        { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
                        { featureType: "poi", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
                        { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
                        { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
                        { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
                        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
                        { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
                        { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#dadada" }] },
                        { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
                        { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
                        { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#e5e5e5" }] },
                        { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#eeeeee" }] },
                        { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9c9c9" }] },
                        { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
                    ]
                });

                // Get location only AFTER map is successfully initialized
                if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
                            centerMap(userPos);
                        },
                        () => {
                            console.warn("Geolocation service failed or was denied. Centering on default location.");
                            centerMap(defaultCenter);
                        },
                        { enableHighAccuracy: true }
                    );
                } else {
                    console.warn("Browser doesn't support geolocation. Centering on default location.");
                    centerMap(defaultCenter);
                }
            } else {
                console.error("Google Maps script not loaded or failed. Check API key in index.html.");
                setMapLoadError(true);
            }
        }
    }, []);

    // Realtime listener for the current ride
    useEffect(() => {
        if (rideState.stage === 'none' || rideState.stage === 'confirming_details' || rideState.stage === 'rating') {
             // If there's no active ride, don't listen to a specific ride channel
            return;
        }

        const channel = supabase
            .channel(`public:rides:id=eq.${rideState.rideId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'rides',
                    filter: `id=eq.${rideState.rideId}`
                },
                (payload) => {
                    const updatedRide = payload.new as Ride;
                    console.log('Ride updated:', updatedRide);
                    
                    if (updatedRide.status === 'driver_en_route' && updatedRide.driver_id) {
                        setRideState(prev => ({ ...prev, stage: 'driver_en_route', driverId: updatedRide.driver_id }));
                    } else if (updatedRide.status === 'in_progress') {
                        setRideState(prev => ({ ...prev, stage: 'in_progress' }));
                    } else if (updatedRide.status === 'completed') {
                        setRideState(prev => ({ ...prev, stage: 'rating' }));
                    } else if (updatedRide.status === 'cancelled') {
                        alert('A corrida foi cancelada.');
                        setRideState(initialRideState);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [rideState.rideId, rideState.stage, setRideState]);

    // Effect for Supabase Realtime Subscription to drivers table
    useEffect(() => {
        let channel: any;

        // State 1: In a ride. Listen ONLY to the assigned driver.
        if (rideState.driverId) {
            // Immediately filter the drivers list to only show the assigned one.
             setDrivers(currentDrivers => currentDrivers.filter(d => d.id === rideState.driverId));

            channel = supabase
                .channel(`driver-location:${rideState.driverId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'drivers',
                        filter: `id=eq.${rideState.driverId}`
                    },
                    (payload) => {
                        const updatedDriver = payload.new as Driver;
                        if (updatedDriver) {
                            // Update the position of our single driver
                            setDrivers([updatedDriver]);
                        }
                    }
                )
                .subscribe();

        // State 2: Not in a ride. Listen to ALL available drivers.
        } else {
            const fetchAndSetInitialDrivers = async () => {
                const { data, error } = await supabase
                    .from('drivers')
                    .select('*')
                    .eq('is_active', true)
                    .eq('status', 'online');
                if (error) {
                    console.error('Error fetching initial drivers:', error);
                } else if (data) {
                    setDrivers(data as Driver[]);
                }
            };
            fetchAndSetInitialDrivers();

            channel = supabase
                .channel('all-drivers-locations')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'drivers' },
                    (payload) => {
                         const changedDriver = (payload.new || payload.old) as Driver;
                         if (!changedDriver) return;

                         setDrivers(currentDrivers => {
                             const existingDriverIndex = currentDrivers.findIndex(d => d.id === changedDriver.id);
                             const isOnlineAndActive = changedDriver.is_active && changedDriver.status === 'online';

                             // DELETE or driver went offline/inactive
                             if ((payload.eventType === 'DELETE' || !isOnlineAndActive) && existingDriverIndex > -1) {
                                 return currentDrivers.filter(d => d.id !== changedDriver.id);
                             }
                             // INSERT or UPDATE for an online/active driver
                             else if ((payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') && isOnlineAndActive) {
                                 if (existingDriverIndex > -1) { // Update existing
                                     const updatedDrivers = [...currentDrivers];
                                     updatedDrivers[existingDriverIndex] = changedDriver;
                                     return updatedDrivers;
                                 } else { // Add new
                                     return [...currentDrivers, changedDriver];
                                 }
                             }
                             return currentDrivers; // No change needed
                         });
                    }
                )
                .subscribe();
        }

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [rideState.driverId]); // This effect ONLY re-runs when we get or lose a driverId

    // Effect to update driver markers on the map when `drivers` state changes
    useEffect(() => {
        if (!mapInstance.current || !window.google) return;
        
        const currentMarkers = driverMarkers.current;
        const driverIdsOnMap = new Set(currentMarkers.keys());
        const driverIdsInState = new Set(drivers.map(d => d.id));
        
        const carIcon = {
            path: 'M17.43,2.46A2.5,2.5,0,0,0,15.5,2H8.5A2.5,2.5,0,0,0,6.57,2.46L2,8.5V16a1,1,0,0,0,1,1H4a1,1,0,0,0,1-1V14H19v2a1,1,0,0,0,1,1h1a1,1,0,0,0,1-1V8.5ZM7,12a2,2,0,1,1,2,2A2,2,0,0,1,7,12Zm10,0a2,2,0,1,1,2,2A2,2,0,0,1,17,12ZM4.4,7,7.87,3.5H16.13L19.6,7Z',
            fillColor: '#1f2937',
            fillOpacity: 1,
            strokeWeight: 0,
            rotation: 0,
            scale: 1.2,
            anchor: new window.google.maps.Point(12, 12),
        };

        // Add or update markers
        drivers.forEach(driver => {
            if (driver.current_latitude && driver.current_longitude) {
                const pos = { lat: driver.current_latitude, lng: driver.current_longitude };
                
                if (currentMarkers.has(driver.id)) {
                    // Animate marker movement smoothly
                    const marker = currentMarkers.get(driver.id);
                    const oldPos = marker.getPosition();
                    const newPos = new window.google.maps.LatLng(pos.lat, pos.lng);
                    
                    // Simple check to avoid animation on first render
                    if (oldPos && !oldPos.equals(newPos)) {
                       // This is a simplified animation. A library like `marker-animate-unobtrusive` could be used for more complex animations.
                       marker.setPosition(newPos);
                    }
                } else {
                    const newMarker = new window.google.maps.Marker({
                        position: pos,
                        map: mapInstance.current,
                        icon: carIcon,
                    });
                    currentMarkers.set(driver.id, newMarker);
                }
            }
        });

        // Remove markers that are no longer in the state
        driverIdsOnMap.forEach(driverId => {
            if (!driverIdsInState.has(driverId)) {
                const marker = currentMarkers.get(driverId);
                marker?.setMap(null);
                currentMarkers.delete(driverId);
            }
        });

    }, [drivers]);


    useEffect(() => {
        const drawRoute = () => {
            if (!window.google || !mapInstance.current || !rideState.from || !rideState.to) return;
            
            if (!directionsRenderer.current) {
                directionsRenderer.current = new window.google.maps.DirectionsRenderer({
                    suppressMarkers: true,
                    polylineOptions: { strokeColor: '#1f2937', strokeWeight: 5 }
                });
                directionsRenderer.current.setMap(mapInstance.current);
            }
            
            const directionsService = new window.google.maps.DirectionsService();
            const waypoints = rideState.stops.map(stop => ({ location: stop, stopover: true }));

            directionsService.route(
                {
                    origin: rideState.from,
                    destination: rideState.to,
                    waypoints: waypoints,
                    travelMode: window.google.maps.TravelMode.DRIVING,
                },
                (result, status) => {
                    if (status === window.google.maps.DirectionsStatus.OK) {
                        directionsRenderer.current.setDirections(result);
                    } else {
                        console.error(`Error fetching directions ${result}`);
                    }
                }
            );
        };
        const clearRoute = () => {
            if (directionsRenderer.current) {
                directionsRenderer.current.setDirections({routes: []});
            }
        };

        if (rideState.stage === 'confirming_details' || rideState.stage === 'driver_en_route' || rideState.stage === 'in_progress') {
            drawRoute();
        } else {
            clearRoute();
        }
    }, [rideState.stage, rideState.from, rideState.to, rideState.stops]);


    const renderRideSheet = () => {
        switch (rideState.stage) {
            case 'confirming_details':
            case 'searching':
                return <RideRequestSheet />;
            case 'driver_en_route':
            case 'in_progress':
                return <RideStatusSheet />;
            case 'rating':
                return <RatingSheet />;
            default:
                return null;
        }
    }

    return (
        <div className="w-full h-full relative overflow-hidden">
            <div ref={mapRef} className="w-full h-full bg-gray-200" style={{ display: mapLoadError ? 'none' : 'block' }} />

            {mapLoadError && (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-center p-4">
                    <div className="p-3 mb-4 bg-gray-200 rounded-full">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700">Ops! Algo deu errado.</h3>
                    <p className="text-gray-500 mt-2 max-w-sm">
                        Esta página não carregou o Google Maps corretamente. Consulte o console para detalhes técnicos.
                    </p>
                </div>
            )}
            
            <SideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
            
            {rideState.stage === 'none' && (
                <>
                    <div className="absolute top-5 left-5 right-5 bg-white rounded-lg shadow-lg flex items-center p-3 z-10 space-x-2">
                        <button onClick={() => setIsMenuOpen(true)} className="p-2 rounded-full hover:bg-gray-100 transition">
                            <MenuIcon />
                        </button>
                        <div 
                            className="flex-grow flex items-center cursor-pointer p-2 rounded-md"
                            onClick={() => navigate(Screen.SearchDestination)}
                        >
                            <SearchIcon className="text-gray-400 mr-3" />
                            <span className="text-lg text-gray-500">Para onde vamos?</span>
                        </div>
                    </div>

                    <button 
                        onClick={() => {
                            if (navigator.geolocation) {
                                 navigator.geolocation.getCurrentPosition((pos) => centerMap({lat: pos.coords.latitude, lng: pos.coords.longitude}));
                            }
                        }} 
                        className="absolute bottom-5 right-5 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-100 z-10 transition"
                        aria-label="Centralizar no local atual"
                    >
                        <LocationTargetIcon />
                    </button>
                </>
            )}

            {renderRideSheet()}
        </div>
    );
};


// --- MAIN APP COMPONENT ---
const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SplashScreen);
    const [loading, setLoading] = useState(true);

    const [rideState, setRideState] = useState<RideState>(initialRideState);
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [navigationOrigin, setNavigationOrigin] = useState<Screen | null>(null);

     const getProfile = async (user: User) => {
        try {
            const { data, error, status } = await supabase
                .from('profiles')
                .select(`id, full_name, phone, fcm_token`)
                .eq('id', user.id)
                .single();

            if (error && status !== 406) {
                throw error;
            }

            if (data) {
                setProfile(data as Profile);
            }
        } catch (error: any) {
            console.error('Error fetching profile:', error.message);
        }
    };
    
    const refreshPaymentMethods = async () => {
        // Use a local variable for user to ensure we have the latest value
        const currentUser = supabase.auth.getUser();
        if (!(await currentUser).data.user) return;
        const userId = (await currentUser).data.user.id;

        try {
            const { data, error } = await supabase
                .from('payment_methods')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            
            if (data) {
                setPaymentMethods(data as PaymentMethod[]);
            }
        } catch (error: any) {
            console.error('Error fetching payment methods:', error.message);
            setPaymentMethods([]); // Clear on error
        }
    };
    
    // Effect to fetch driver details when a driver is assigned to a ride
    useEffect(() => {
        const fetchDriverDetails = async () => {
            if (rideState.driverId && !rideState.driverDetails) {
                try {
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('full_name')
                        .eq('id', rideState.driverId)
                        .single();

                    const { data: driverData, error: driverError } = await supabase
                        .from('drivers')
                        .select('vehicle_model, vehicle_color, license_plate')
                        .eq('id', rideState.driverId)
                        .single();

                    if (profileError || driverError) throw profileError || driverError;
                    
                    if (profileData && driverData) {
                        setRideState(prev => ({ ...prev, driverDetails: { ...profileData, ...driverData } as DriverDetails }));
                    }

                } catch(e: any) {
                    console.error("Failed to fetch driver details:", e.message);
                    setRideState(prev => ({...prev, driverDetails: null})); // Clear on error
                }
            }
             // Clear driver details if driverId is cleared
            if (!rideState.driverId && rideState.driverDetails) {
                setRideState(prev => ({...prev, driverDetails: null}));
            }
        };
        fetchDriverDetails();
    }, [rideState.driverId]);


    useEffect(() => {
        const fetchInitialData = async (session: Session) => {
            if (session?.user) {
                setUser(session.user);
                await getProfile(session.user);
                await refreshPaymentMethods();
                setCurrentScreen(Screen.MainMap);
            } else {
                setUser(null);
                setProfile(null);
                setPaymentMethods([]);
                setCurrentScreen(Screen.Login);
            }
            setLoading(false);
        };
    
        // Immediately fetch the session and then set up the listener
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            fetchInitialData(session);
    
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
                if (_event === 'PASSWORD_RECOVERY') {
                    setSession(session);
                    setCurrentScreen(Screen.ResetPassword);
                    setLoading(false);
                    return; 
                }
                setSession(session);
                // When auth state changes, refetch everything else
                fetchInitialData(session);
            });
    
            return () => {
                subscription.unsubscribe();
            };
        });
    }, []);

    const signOut = () => {
      supabase.auth.signOut();
    };
    
    const navigate = (screen: Screen) => setCurrentScreen(screen);

    const appContextValue: AppContextType = {
        session, user, profile, setProfile, signOut, navigate,
        rideState, setRideState, paymentMethods, setPaymentMethods, refreshPaymentMethods, navigationOrigin
    };

    const renderScreen = () => {
        if (loading) return <SplashScreen />;
        
        switch (currentScreen) {
            case Screen.SplashScreen: return <SplashScreen />;
            case Screen.Login: return <LoginScreen />;
            case Screen.SignUp: return <SignUpScreen />;
            case Screen.SignUpSuccess: return <SignUpSuccessScreen />;
            case Screen.ForgotPassword: return <ForgotPasswordScreen />;
            case Screen.ResetPassword: return <ResetPasswordScreen />;
            case Screen.MainMap: return <MainMapScreen />;
            case Screen.SearchDestination: return <SearchDestinationScreen />;
            case Screen.Profile: return <ProfileScreen />;
            case Screen.History: return <HistoryScreen />;
            case Screen.Payments: return <PaymentsScreen />;
            case Screen.Support: return <SupportScreen />;
            case Screen.Settings: return <SettingsScreen />;
            case Screen.ChangePassword: return <ChangePasswordScreen />;
            case Screen.HelpCenter: return <HelpCenterScreen />;
            case Screen.ContactSupport: return <ContactSupportScreen />;
            case Screen.ReportProblem: return <ReportProblemScreen />;
            case Screen.TermsAndPolicy: return <TermsAndPolicyScreen />;
            case Screen.PrivacyPolicy: return <PrivacyPolicyScreen />;
            case Screen.AddCard: return <AddCardScreen />;
            case Screen.ScheduledRides: return <ScheduledRidesScreen />;
            case Screen.Chat: return <ChatScreen />;
            default: return <LoginScreen />;
        }
    };

    return (
        <AppContext.Provider value={appContextValue}>
             <div className="w-full h-full font-sans">
                {renderScreen()}
            </div>
        </AppContext.Provider>
    );
};

export default App;