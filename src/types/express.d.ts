declare namespace Express {
	interface Request {
		user?: {
			userId: string;
			jti: string;
			deviceId: string;
			fingerprint?: string;
		};
	}
}
