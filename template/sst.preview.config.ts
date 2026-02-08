const { ZERO_ADMIN_PASSWORD } = process.env

// TODO: Fill these after running: npx sst deploy --stage dev --config sst.dev.config.ts
// Preview stages (pr-*) share dev's VPC, RDS, and wildcard certs.
const DEV_VPC_ID = 'TODO:DEV_VPC_ID'
const DEV_RDS_ID = 'TODO:DEV_RDS_ID'
const WILDCARD_CERT_ALB = 'TODO:WILDCARD_CERT_ALB'
const WILDCARD_CERT_CF = 'TODO:WILDCARD_CERT_CF'

export default $config({
  app() {
    return {
      name: 'zero-app',
      removal: 'remove',
      protect: false,
      home: 'aws',
      providers: {
        aws: {
          region: 'us-east-1',
        },
        cloudflare: {},
      },
    }
  },
  async run() {
    const prefix = `${$app.stage}-`

    const dns = sst.cloudflare.dns({
      zone: 'TODO:CLOUDFLARE_ZONE_ID',
    })

    const vpc = sst.aws.Vpc.get('Vpc', DEV_VPC_ID)

    const db = sst.aws.Postgres.get('Database', { id: DEV_RDS_ID })
    const dbName = `zero_app_${$app.stage.replace(/-/g, '_')}`

    const cluster = new sst.aws.Cluster('Cluster', { vpc })

    const api = new sst.aws.Service('Api', {
      cluster,
      capacity: 'spot',
      image: {
        context: '.',
        dockerfile: 'packages/api/Dockerfile',
      },
      dev: {
        command: 'pnpm --filter @app/api run dev',
      },
      loadBalancer: {
        domain: {
          name: `${prefix}api.TODO:DOMAIN`,
          dns,
          cert: WILDCARD_CERT_ALB,
        },
        rules: [
          { listen: '80/http', redirect: '443/https' },
          { listen: '443/https', forward: '3001/http' },
        ],
        health: {
          '3001/http': {
            path: '/health',
            interval: '10 seconds',
          },
        },
      },
    })

    const zeroCache = new sst.aws.Service('ZeroCache', {
      cluster,
      capacity: 'spot',
      image: 'rocicorp/zero:latest',
      environment: {
        ZERO_ADMIN_PASSWORD: new sst.Secret(
          'ZeroAdminPassword',
          ZERO_ADMIN_PASSWORD,
        ).value,
        ZERO_UPSTREAM_DB: $interpolate`postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${dbName}`,
        ZERO_QUERY_URL: $interpolate`${api.url}api/zero/query`,
        ZERO_MUTATE_URL: $interpolate`${api.url}api/zero/mutate`,
        ZERO_REPLICA_FILE: '/tmp/zero.db',
        ZERO_LOG_LEVEL: 'info',
      },
      dev: false,
      loadBalancer: {
        domain: {
          name: `${prefix}zero.TODO:DOMAIN`,
          dns,
          cert: WILDCARD_CERT_ALB,
        },
        rules: [
          { listen: '80/http', redirect: '443/https' },
          { listen: '443/https', forward: '4848/http' },
        ],
        health: {
          '4848/http': {
            path: '/',
            interval: '10 seconds',
            healthyThreshold: 2,
            unhealthyThreshold: 5,
          },
        },
      },
      transform: {
        service: {
          healthCheckGracePeriodSeconds: 120,
        },
      },
    })

    const router = new sst.aws.Router('Router', {
      domain: {
        name: `${prefix}app.TODO:DOMAIN`,
        dns,
        cert: WILDCARD_CERT_CF,
      },
    })

    router.route('/api', api.url)

    new sst.aws.React('Web', {
      path: 'packages/web',
      router: { instance: router },
      environment: {
        VITE_ZERO_CACHE_URL: zeroCache.url,
      },
    })
  },
})
