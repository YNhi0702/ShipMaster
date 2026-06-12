const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Cloud Function để thay đổi mật khẩu người dùng.
 * Chỉ Admin (hoặc người có quyền) mới gọi được hàm này.
 * 
 * @param {Object} data - Dữ liệu gửi lên: { uid: '...', newPassword: '...' }
 * @param {Object} context - Context auth của người gọi.
 */
exports.changeUserPassword = functions.https.onCall(async (data, context) => {
    // 1. Kiểm tra quyền (Optional: chỉ cho phép Director/Admin gọi)
    // if (!context.auth || context.auth.token.role !== 'director') {
    //     throw new functions.https.HttpsError('permission-denied', 'Bạn không có quyền thực hiện hành động này.');
    // }

    const { uid, newPassword } = data;

    if (!uid || !newPassword) {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu thông tin uid hoặc mật khẩu mới.');
    }

    if (newPassword.length < 6) {
        throw new functions.https.HttpsError('invalid-argument', 'Mật khẩu phải có ít nhất 6 ký tự.');
    }

    try {
        // 2. Gọi Admin SDK để update password
        await admin.auth().updateUser(uid, {
            password: newPassword,
        });

        return { message: 'Đổi mật khẩu thành công!' };
    } catch (error) {
        console.error('Lỗi đổi mật khẩu:', error);
        throw new functions.https.HttpsError('internal', 'Không thể đổi mật khẩu: ' + error.message);
    }
});

/**
 * Cloud Function để xóa người dùng hoàn toàn khỏi Auth.
 */
exports.deleteUserAuth = functions.https.onCall(async (data, context) => {
    const { uid } = data;
    if (!uid) {
        throw new functions.https.HttpsError('invalid-argument', 'Thiếu uid.');
    }

    try {
        await admin.auth().deleteUser(uid);
        return { message: 'Xóa tài khoản Auth thành công!' };
    } catch (error) {
        throw new functions.https.HttpsError('internal', 'Lỗi xóa Auth: ' + error.message);
    }
});

// Ensure customers documents have a unique referralCode
const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomCode(length = 8) {
    let s = '';
    for (let i = 0; i < length; i++) {
        s += REF_CHARS.charAt(Math.floor(Math.random() * REF_CHARS.length));
    }
    return s;
}

async function generateUniqueReferral(adminDb, length = 8) {
    let attempts = 0;
    while (attempts < 1000) {
        const code = randomCode(length);
        const snap = await adminDb.collection('customers').where('referralCode', '==', code).limit(1).get();
        if (snap.empty) return code;
        attempts++;
    }
    throw new Error('Unable to generate unique referral code');
}

exports.ensureReferralCode = functions.firestore
    .document('customers/{uid}')
    .onWrite(async (change, context) => {
        const after = change.after;
        if (!after.exists) return null; // deleted

        const data = after.data();
        if (data && data.referralCode) return null; // already has

        try {
            const db = admin.firestore();
            const code = await generateUniqueReferral(db, 8);
            await after.ref.update({ referralCode: code });
            console.log(`Assigned referralCode ${code} to ${context.params.uid}`);
        } catch (err) {
            console.error('Error assigning referralCode:', err);
        }
        return null;
    });
