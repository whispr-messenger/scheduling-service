// Environment validation for production container
const colors = {
	reset: '\u001b[0m',
	red: '\u001b[31m',
	green: '\u001b[32m',
	yellow: '\u001b[33m',
};

let missingVars = 0;
let optionalVars = 0;

function checkRequired(varName: string): boolean {
	const value = process.env[varName];
	if (!value || value.trim() === '') {
		console.error(`${colors.red}✗${colors.reset} ${varName} is NOT set (REQUIRED)`);
		missingVars++;
		return false;
	}
	console.log(`${colors.green}✓${colors.reset} ${varName} is set`);
	return true;
}

function checkOptional(varName: string, defaultValue = ''): boolean {
	const value = process.env[varName];
	if (!value || value.trim() === '') {
		const msg = defaultValue ? ` (will use default: ${defaultValue})` : '';
		console.warn(`${colors.yellow}⚠${colors.reset} ${varName} is NOT set${msg}`);
		optionalVars++;
		return false;
	}
	console.log(`${colors.green}✓${colors.reset} ${varName} is set`);
	return true;
}

function checkRequiredOneOf(varNames: string[]): boolean {
	const hasAny = varNames.some((name) => {
		const value = process.env[name];
		return Boolean(value && value.trim() !== '');
	});

	if (!hasAny) {
		console.error(`${colors.red}✗${colors.reset} One of [${varNames.join(', ')}] must be set (REQUIRED)`);
		missingVars++;
		return false;
	}

	console.log(`${colors.green}✓${colors.reset} One of [${varNames.join(', ')}] is set`);
	return true;
}

export default function runEnvChecks(): void {
	console.log('==================================================');
	console.log('  Whispr Scheduling Service - Environment Check');
	console.log('==================================================\n');

	console.log('Checking REQUIRED environment variables...');

	// Node
	checkRequired('NODE_ENV');

	// Database (TypeORM)
	checkRequired('DB_HOST');
	checkRequired('DB_PORT');
	checkRequired('DB_USERNAME');
	checkRequired('DB_PASSWORD');
	checkRequired('DB_NAME');

	// Redis
	checkRequired('REDIS_HOST');
	checkRequired('REDIS_PORT');

	// Ports
	// main.ts reads PORT, while docker/health scripts may read HTTP_PORT.
	// Accept either for startup validation to avoid false negatives.
	checkRequiredOneOf(['PORT', 'HTTP_PORT']);

	// Inter-service Redis pub/sub channels (defaults applied at runtime if absent)
	checkOptional('MESSAGING_EVENTS_CHANNEL', 'whispr.messaging.events');
	checkOptional('NOTIFICATION_EVENTS_CHANNEL', 'whispr.notification.events');

	console.log('\nChecking OPTIONAL environment variables...');

	checkOptional('REDIS_PASSWORD', '(no password)');
	checkOptional('REDIS_DB', '0');
	checkOptional('NODE_OPTIONS', '(default Node settings)');
	checkOptional('LOG_LEVEL', 'info');
	checkOptional('METRICS_ENABLED', 'true');
	checkOptional('BULL_BOARD_ENABLED', 'false');
	checkOptional('SWAGGER_ENABLED', 'true');
	checkOptional('HEALTH_CHECK_TIMEOUT', '5000');

	console.log('\n==================================================');

	if (missingVars > 0) {
		console.error(
			`${colors.red}ERROR: ${missingVars} required environment variable(s) missing!${colors.reset}`
		);
		throw new Error('Missing required environment variables');
	}

	if (optionalVars > 0) {
		console.warn(
			`${colors.yellow}WARNING: ${optionalVars} optional environment variable(s) not set.${colors.reset}`
		);
	}

	console.log(`${colors.green}✓ All required environment variables are set!${colors.reset}`);
	console.log('==================================================\n');
}
