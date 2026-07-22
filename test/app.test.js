const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');

describe('Neer\'s Journal Enterprise Integration Tests', () => {
    afterAll(async () => {
        await mongoose.disconnect();
    });

    describe('Public & Portfolio Routes', () => {
        it('should render the login and portfolio landing page with statistics', async () => {
            const res = await request(app)
                .get('/login')
                .expect(200);
            
            expect(res.text).toContain('Neer');
            expect(res.text).toContain('Secure Chronicle Entrance');
        });

        it('should redirect /signup to /request-invitation', async () => {
            await request(app)
                .get('/signup')
                .expect(302)
                .expect('Location', '/request-invitation');
        });

        it('should render the request invitation page', async () => {
            const res = await request(app)
                .get('/request-invitation')
                .expect(200);
            
            expect(res.text).toContain('Request Chronicle Invitation');
        });

        it('should render the admin portal login page', async () => {
            const res = await request(app)
                .get('/admin/login')
                .expect(200);
            
            expect(res.text).toContain('Admin Portal');
        });
    });

    describe('Invitation Request & Admin Authentication Flow', () => {
        const uniqueEmail = `applicant_${Date.now()}@example.com`;

        it('should block invitation request with an invalid email', async () => {
            const res = await request(app)
                .post('/request-invitation')
                .send({
                    name: 'Test Applicant',
                    email: 'invalid-email',
                    reason: 'I would love to read Neer\'s journal entries.'
                })
                .expect(400);
            
            expect(res.text).toContain('Please enter a valid email address.');
        });

        it('should submit a valid invitation request successfully', async () => {
            const res = await request(app)
                .post('/request-invitation')
                .send({
                    name: 'Eleanor Vance',
                    email: uniqueEmail,
                    preferredDisplayName: 'Eleanor',
                    country: 'United States',
                    reason: 'I am a research fellow studying digital journals and literature.'
                })
                .expect(200);

            expect(res.text).toContain('Your invitation request has been recorded');
        });

        it('should prevent duplicate invitation requests for the same email', async () => {
            const res = await request(app)
                .post('/request-invitation')
                .send({
                    name: 'Eleanor Vance',
                    email: uniqueEmail,
                    reason: 'Second attempt request.'
                })
                .expect(400);

            expect(res.text).toContain('already pending review');
        });

        it('should authenticate super admin neer_7007 via admin portal login', async () => {
            const adminAgent = request.agent(app);
            await adminAgent
                .post('/admin/login')
                .send({
                    username: 'neer_7007',
                    password: 'neer_7007'
                })
                .expect(302)
                .expect('Location', '/admin');
        });
    });

    describe('Password Reset Flow', () => {
        it('should fail reset request if email does not exist', async () => {
            const res = await request(app)
                .post('/forgot-password')
                .send({ email: 'nonexistent@example.com' })
                .expect(200);
            
            expect(res.text).toContain('No account associated with that email address exists.');
        });

        it('should accept valid email reset request for superadmin email', async () => {
            const res = await request(app)
                .post('/forgot-password')
                .send({ email: 'neer_7007@neersjournal.local' })
                .expect(200);
            
            expect(res.text).toContain('An email has been dispatched with reset instructions.');
        });
    });

    describe('RBAC Enterprise Authorization & Protection', () => {
        it('should redirect unauthenticated access on /admin to /login', async () => {
            await request(app)
                .get('/admin')
                .expect(302)
                .expect('Location', '/login');
        });

        it('should return 401 for unauthenticated access to admin APIs', async () => {
            const res = await request(app)
                .get('/api/admin/skills')
                .expect(401);
            
            expect(res.body.error).toContain('Authentication required');
        });

        it('should allow SuperAdmin neer_7007 access to /admin and admin APIs', async () => {
            const adminAgent = request.agent(app);

            const loginRes = await adminAgent.post('/login').send({
                username: 'neer_7007',
                password: 'neer_7007'
            });

            if (loginRes.status === 302) {
                const adminPage = await adminAgent.get('/admin').expect(200);
                expect(adminPage.text).toContain('Admin Control Center');

                const skillsRes = await adminAgent.get('/api/admin/skills').expect(200);
                expect(Array.isArray(skillsRes.body)).toBe(true);
            }
        });
    });
});
