// src/routes/PrivateRoute.tsx
import React, { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface PrivateRouteProps {
    children: ReactNode;
    allowedRoles: string[];
}

const PrivateRoute: React.FC<PrivateRouteProps> = ({ children, allowedRoles }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                // Ưu tiên kiểm tra collection users
                const docRef = doc(db, 'users', currentUser.uid);
                const docSnap = await getDoc(docRef);
                let userData = docSnap.data();
                let foundRole = userData?.role || userData?.Role_ID || null;
                // Nếu không có role ở users, kiểm tra employees
                if (!foundRole) {
                    const empRef = doc(db, 'employees', currentUser.uid);
                    const empSnap = await getDoc(empRef);
                    const empData = empSnap.data();
                    foundRole = empData?.role || empData?.Role_ID || null;
                }
                setRole(foundRole);
                setUser(currentUser);
            } else {
                setUser(null);
                setRole(null);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    if (loading) return <p>Loading...</p>;

    // Normalize role về string để so sánh
    const roleStr = role ? String(role).toLowerCase() : '';
    const allowedRolesStr = allowedRoles.map(r => String(r).toLowerCase());
    // Cho phép inspector: 1, '1', 'inspector', 'officer'
    const isInspector = ['1', 'inspector', 'officer'].includes(roleStr) && allowedRolesStr.some(r => ['1','inspector','officer'].includes(r));
    // Cho phép customer: 0, '0', 'customer'
    const isCustomer = ['0', 'customer'].includes(roleStr) && allowedRolesStr.some(r => ['0','customer'].includes(r));
    // Cho phép workshop owner: 2, '2', 'workshop', 'workshop_owner', 'owner'
    const isWorkshopOwner = ['2', 'workshop', 'workshop_owner', 'owner'].includes(roleStr) && allowedRolesStr.some(r => ['2', 'workshop', 'workshop_owner', 'owner'].includes(r));
    // Cho phép accountant, workshop_owner, director nếu cần

    // Debug log
    console.log('PrivateRoute: user', user?.uid, 'role', roleStr, 'allowed', allowedRolesStr, 'isInspector', isInspector, 'isCustomer', isCustomer);

    if (!user || (!isInspector && !isCustomer && !isWorkshopOwner)) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

export default PrivateRoute;
