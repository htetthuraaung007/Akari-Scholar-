import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UserProfile {
  email: string;
  name: string;
  picture: string;
  isLoggedIn: boolean;
  loginMethod: 'google' | 'guest';
}

interface AuthContextType {
  user: UserProfile;
  loginWithGoogle: (mockEmail?: string, mockName?: string) => void;
  logout: () => void;
  savedApiKey: string;
  saveUserApiKey: (key: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile>(() => {
    try {
      const saved = localStorage.getItem('akari_google_auth_v1');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return {
      email: '',
      name: '',
      picture: '',
      isLoggedIn: false,
      loginMethod: 'guest',
    };
  });

  const [savedApiKey, setSavedApiKey] = useState<string>(() => {
    return localStorage.getItem('akari_user_custom_gemini_key_v1') || '';
  });

  useEffect(() => {
    localStorage.setItem('akari_google_auth_v1', JSON.stringify(user));
  }, [user]);

  const loginWithGoogle = (mockEmail = 'student.uopeople@gmail.com', mockName = 'UoPeople Scholar') => {
    const newUser: UserProfile = {
      email: mockEmail,
      name: mockName,
      picture: `https://api.dicebear.com/7.x/avataaars/svg?seed=${mockEmail}`,
      isLoggedIn: true,
      loginMethod: 'google',
    };
    setUser(newUser);
  };

  const logout = () => {
    setUser({
      email: '',
      name: '',
      picture: '',
      isLoggedIn: false,
      loginMethod: 'guest',
    });
    localStorage.removeItem('akari_google_auth_v1');
  };

  const saveUserApiKey = (key: string) => {
    const cleanKey = key.replace(/["'\s]/g, '').trim();
    setSavedApiKey(cleanKey);
    if (cleanKey) {
      localStorage.setItem('akari_gemini_api_key_primary', cleanKey);
      localStorage.setItem('akari_user_custom_gemini_key_v1', cleanKey);
    } else {
      localStorage.removeItem('akari_gemini_api_key_primary');
      localStorage.removeItem('akari_user_custom_gemini_key_v1');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithGoogle,
        logout,
        savedApiKey,
        saveUserApiKey,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
