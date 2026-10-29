jest.mock('firebase/auth', () => ({
    signInWithCustomToken: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({}));
jest.mock('../../firebaseConfig', () => ({ FIREBASE_AUTH: { name: 'auth' }, FIREBASE_DB: {}, FIREBASE_APP: {} }));

const { signInWithCustomToken } = require('firebase/auth');
const { signInDriverWithPhone } = require('../Firebase');

const respond = (status, body) => {
    global.fetch = jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });
};

describe('signInDriverWithPhone', () => {
    beforeEach(() => {
        signInWithCustomToken.mockReset();
    });

    it('signs in with the custom token the server returns and never handles an email', async () => {
        respond(200, { success: true, token: 'tok123' });
        signInWithCustomToken.mockResolvedValue({ user: { uid: 'drv1' } });

        const user = await signInDriverWithPhone('08031234567', 'secret');

        expect(user).toEqual({ uid: 'drv1' });
        expect(signInWithCustomToken).toHaveBeenCalledWith({ name: 'auth' }, 'tok123');
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toMatch(/\/api\/auth\/driver-login$/);
        expect(JSON.parse(options.body)).toEqual({ phone: '08031234567', password: 'secret' });
    });

    it.each([
        [401, { code: 'invalid-credentials', error: 'Invalid phone number or password' }, 'auth/invalid-credential'],
        [400, { code: 'invalid-phone', error: 'Invalid Nigerian phone number format' }, 'auth/invalid-email'],
        [403, { code: 'user-disabled', error: 'disabled' }, 'auth/user-disabled'],
        [429, { code: 'too-many-requests', error: 'Too many attempts' }, 'auth/too-many-requests'],
    ])('maps HTTP %i to the error code the login screen already handles', async (status, body, code) => {
        respond(status, body);
        await expect(signInDriverWithPhone('08031234567', 'x')).rejects.toMatchObject({ code });
        expect(signInWithCustomToken).not.toHaveBeenCalled();
    });

    it('reports network failures with wording the screen shows as a connection error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
        await expect(signInDriverWithPhone('08031234567', 'x')).rejects.toThrow(/internet/);
    });

    it('rejects when the server reports success without a token', async () => {
        respond(200, { success: true });
        await expect(signInDriverWithPhone('08031234567', 'x')).rejects.toThrow();
        expect(signInWithCustomToken).not.toHaveBeenCalled();
    });
});
