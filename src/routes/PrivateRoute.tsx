import React, { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface PrivateRouteProps {
    children: ReactNode;
    allowedRoles: string[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
    const [userRole, setUserRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isActive = true;

        const fetchUserRole = async () => {
            setLoading(true);

            const cachedRole = sessionStorage.getItem('role') || localStorage.getItem('role');
            if (cachedRole) {
                if (isActive) {
                    setUserRole(cachedRole);
                    setLoading(false);
                }
                return;
            }

            const uid = sessionStorage.getItem('uid') || localStorage.getItem('uid');
            if (!uid) {
                if (isActive) {
                    setUserRole(null);
                    setLoading(false);
                }
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const roleFromDb = userDoc.exists() ? userDoc.data().role : null;

                if (roleFromDb) {
                    sessionStorage.setItem('role', roleFromDb);
                    localStorage.setItem('role', roleFromDb);
                }

                if (isActive) {
                    setUserRole(roleFromDb);
                }
            } catch (error) {
                console.error('Error fetching user role:', error);
                if (isActive) {
                    setUserRole(null);
                }
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        fetchUserRole();

        return () => {
            isActive = false;
        };
    }, []);

    if (loading) return <div>Loading...</div>;
    if (!userRole) return <Navigate to="/login" replace />;
    if (!allowedRoles.includes(userRole)) return <Navigate to="/login" replace />;

    return <>{children}</>;
};

export default PrivateRoute;
