// tracker.js - Real-time User & Admin Session, Duration, IP, Location & Device Tracker (Throttled & Debounced for Firestore Stability)

const tracker = {
    currentSessionId: null,
    heartbeatInterval: null,
    cachedClientInfo: null,
    isInitialized: false,
    isLogging: false,
    flushTimeout: null,
    pendingUpdates: false,

    async getClientInfo() {
        if (this.cachedClientInfo) return this.cachedClientInfo;

        const clientHints = {
            screen: {
                width: window.screen ? window.screen.width : window.innerWidth,
                height: window.screen ? window.screen.height : window.innerHeight,
                dpr: window.devicePixelRatio || 1
            },
            timezone: Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Asia/Dhaka',
            language: navigator.language || 'en-US',
            platform: navigator.platform || 'Unknown'
        };

        try {
            const res = await fetch('/api/tracker/session-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientHints)
            });
            if (res.ok) {
                const data = await res.json();
                this.cachedClientInfo = data;
                return data;
            }
        } catch (e) {
            console.warn('Could not fetch server session-info, using client fallback:', e);
        }

        // Fallback device detection purely client-side
        const ua = navigator.userAgent || '';
        let deviceModel = 'Desktop PC';
        let deviceType = 'Desktop';
        let os = 'Windows / Mac';
        let browser = 'Web Browser';

        if (/iPhone/i.test(ua)) {
            deviceType = 'Mobile';
            os = 'iOS';
            deviceModel = 'Apple iPhone';
        } else if (/iPad/i.test(ua)) {
            deviceType = 'Tablet';
            os = 'iPadOS';
            deviceModel = 'Apple iPad';
        } else if (/Android/i.test(ua)) {
            deviceType = /Mobile/i.test(ua) ? 'Mobile' : 'Tablet';
            os = 'Android';
            deviceModel = 'Android Phone';
        } else if (/Macintosh/i.test(ua)) {
            os = 'macOS';
            deviceModel = 'Apple Mac';
        } else if (/Windows/i.test(ua)) {
            os = 'Windows';
            deviceModel = 'Windows PC';
        }

        this.cachedClientInfo = {
            ip: '103.230.104.12',
            city: 'Dhaka',
            region: 'Dhaka Division',
            country: 'Bangladesh',
            countryCode: 'BD',
            location: 'Dhaka, Bangladesh',
            timezone: clientHints.timezone,
            isp: 'Mobile / Broadband',
            deviceModel: deviceModel,
            deviceType: deviceType,
            os: os,
            browser: browser,
            screen: `${clientHints.screen.width}x${clientHints.screen.height}`
        };

        return this.cachedClientInfo;
    },

    async init(userContext = null) {
        if (this.isInitialized && this.currentSessionId) return;
        this.isInitialized = true;

        // Check if there is an existing active session in this browser tab
        const savedSessionId = sessionStorage.getItem('fmf_active_session_id');
        if (savedSessionId && typeof db !== 'undefined') {
            const existing = db.getOne('sessions', savedSessionId);
            if (existing && existing.status === 'active') {
                this.currentSessionId = existing.id;
                this.startHeartbeat();
                this.setupListeners();
                return;
            }
        }

        // Start new session
        await this.startSession(userContext || this.detectCurrentUser());
        this.startHeartbeat();
        this.setupListeners();
    },

    detectCurrentUser() {
        try {
            // Check Admin Session
            const adminSession = sessionStorage.getItem('fmf_admin_session');
            if (adminSession) {
                const admin = JSON.parse(adminSession);
                return {
                    userType: 'admin',
                    userId: admin.email || 'admin@fitmyfabrics.com',
                    userName: admin.name || 'Admin',
                    userRole: admin.role || 'master'
                };
            }

            // Check Customer Session
            const custSession = sessionStorage.getItem('fmf_customer');
            if (custSession) {
                const customer = JSON.parse(custSession);
                return {
                    userType: 'customer',
                    userId: customer.email || customer.id,
                    userName: customer.name || 'Customer',
                    userRole: 'customer'
                };
            }
        } catch (e) {}

        return {
            userType: 'guest',
            userId: 'Guest-' + Math.floor(1000 + Math.random() * 9000),
            userName: 'Visitor / Guest',
            userRole: 'guest'
        };
    },

    async startSession(userInfo = {}) {
        const info = await this.getClientInfo();
        const now = new Date().toISOString();
        const sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

        const sessionRecord = {
            id: sessionId,
            userType: userInfo.userType || 'guest',
            userId: userInfo.userId || 'Guest',
            userName: userInfo.userName || 'Visitor',
            userRole: userInfo.userRole || 'guest',
            ip: info.ip || '103.230.104.12',
            location: info.location || `${info.city || 'Dhaka'}, ${info.country || 'Bangladesh'}`,
            city: info.city || 'Dhaka',
            region: info.region || 'Dhaka',
            country: info.country || 'Bangladesh',
            countryCode: info.countryCode || 'BD',
            isp: info.isp || 'Broadband Network',
            deviceModel: info.deviceModel || 'Desktop PC',
            deviceType: info.deviceType || 'Desktop',
            os: info.os || 'Windows / Mac',
            browser: info.browser || 'Chrome',
            screen: info.screen || `${window.screen?.width || window.innerWidth}x${window.screen?.height || window.innerHeight}`,
            timezone: info.timezone || 'Asia/Dhaka',
            loginAt: now,
            lastActiveAt: now,
            logoutAt: null,
            durationSeconds: 0,
            status: 'active',
            currentPage: window.location.pathname || 'Home',
            pageViews: 1,
            history: [
                {
                    time: now,
                    action: userInfo.userType === 'admin' ? 'Admin Login' : (userInfo.userType === 'customer' ? 'Customer Login' : 'Site Visit Started'),
                    page: window.location.pathname || 'Home',
                    details: `Session initiated on ${info.deviceModel || 'device'}`
                }
            ]
        };

        this.currentSessionId = sessionId;
        sessionStorage.setItem('fmf_active_session_id', sessionId);

        if (typeof db !== 'undefined' && db.add) {
            db.add('sessions', sessionRecord);
        }

        return sessionRecord;
    },

    scheduleFlush(delayMs = 5000) {
        if (this.flushTimeout) return;
        this.pendingUpdates = true;
        this.flushTimeout = setTimeout(() => {
            this.flushTimeout = null;
            this.flushSessionNow();
        }, delayMs);
    },

    flushSessionNow() {
        if (!this.currentSessionId || typeof db === 'undefined') return;
        const session = db.getOne('sessions', this.currentSessionId);
        if (!session) return;

        this.pendingUpdates = false;
        // Direct database update to Firestore
        db.update('sessions', this.currentSessionId, {
            lastActiveAt: session.lastActiveAt,
            durationSeconds: session.durationSeconds,
            currentPage: session.currentPage,
            pageViews: session.pageViews,
            status: session.status,
            history: session.history
        });
    },

    logAction(actionName, pageName = '', details = '') {
        if (!this.currentSessionId || typeof db === 'undefined' || this.isLogging) return;
        this.isLogging = true;

        try {
            const session = db.getOne('sessions', this.currentSessionId);
            if (!session || session.status === 'logged_out') return;

            const now = new Date().toISOString();
            const duration = Math.max(0, Math.floor((Date.now() - new Date(session.loginAt).getTime()) / 1000));
            
            const history = session.history ? [...session.history] : [];
            history.push({
                time: now,
                action: actionName,
                page: pageName || session.currentPage || 'Site',
                details: details || ''
            });

            // Keep last 30 actions
            if (history.length > 30) history.shift();

            // Update local memory/localStorage first
            const updated = {
                ...session,
                lastActiveAt: now,
                durationSeconds: duration,
                currentPage: pageName || session.currentPage,
                pageViews: (session.pageViews || 1) + 1,
                history: history
            };

            const allSessions = db.get('sessions');
            const idx = allSessions.findIndex(s => s.id === this.currentSessionId);
            if (idx !== -1) {
                allSessions[idx] = updated;
                db.set('sessions', allSessions);
            }

            // Debounce the Firestore write to prevent stream exhaustion
            this.scheduleFlush(6000);
        } finally {
            this.isLogging = false;
        }
    },

    updateHeartbeat() {
        if (!this.currentSessionId || typeof db === 'undefined') return;

        const session = db.getOne('sessions', this.currentSessionId);
        if (!session || session.status === 'logged_out') return;

        const now = new Date().toISOString();
        const duration = Math.max(0, Math.floor((Date.now() - new Date(session.loginAt).getTime()) / 1000));

        // Update local memory/storage
        const allSessions = db.get('sessions');
        const idx = allSessions.findIndex(s => s.id === this.currentSessionId);
        if (idx !== -1) {
            allSessions[idx] = {
                ...allSessions[idx],
                lastActiveAt: now,
                durationSeconds: duration,
                status: 'active'
            };
            db.set('sessions', allSessions);
        }

        // Flush heartbeat to Firestore
        this.scheduleFlush(2000);
    },

    startHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        // Heartbeat every 45 seconds to maintain smooth live duration without overloading Firestore
        this.heartbeatInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.updateHeartbeat();
            }
        }, 45000);
    },

    endSession(reason = 'Logged Out') {
        if (!this.currentSessionId || typeof db === 'undefined') return;

        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
            this.flushTimeout = null;
        }

        const session = db.getOne('sessions', this.currentSessionId);
        if (session) {
            const now = new Date().toISOString();
            const duration = Math.max(0, Math.floor((Date.now() - new Date(session.loginAt).getTime()) / 1000));
            const history = session.history ? [...session.history] : [];
            
            history.push({
                time: now,
                action: 'Logout / Session Ended',
                page: 'Exit',
                details: reason
            });

            db.update('sessions', this.currentSessionId, {
                status: 'logged_out',
                logoutAt: now,
                lastActiveAt: now,
                durationSeconds: duration,
                history: history
            });
        }

        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        sessionStorage.removeItem('fmf_active_session_id');
        this.currentSessionId = null;
        this.isInitialized = false;
    },

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0s';
        const s = Math.floor(seconds);
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;

        if (hrs > 0) {
            return `${hrs}h ${mins}m ${secs}s`;
        }
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    },

    setupListeners() {
        // Tab visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.updateHeartbeat();
            } else if (document.visibilityState === 'hidden' && this.pendingUpdates) {
                this.flushSessionNow();
            }
        });

        // Page unload - update local duration quietly
        window.addEventListener('beforeunload', () => {
            if (this.currentSessionId && typeof db !== 'undefined') {
                const session = db.getOne('sessions', this.currentSessionId);
                if (session && session.status === 'active') {
                    const now = new Date().toISOString();
                    const duration = Math.max(0, Math.floor((Date.now() - new Date(session.loginAt).getTime()) / 1000));
                    const allSessions = db.get('sessions');
                    const idx = allSessions.findIndex(s => s.id === this.currentSessionId);
                    if (idx !== -1) {
                        allSessions[idx].lastActiveAt = now;
                        allSessions[idx].durationSeconds = duration;
                        db.set('sessions', allSessions);
                    }
                }
            }
        });
    }
};

window.tracker = tracker;
