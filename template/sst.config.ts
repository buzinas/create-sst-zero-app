const { POSTGRES_PASSWORD, ZERO_ADMIN_PASSWORD } = process.env

// TODO: Fill these after running: npx sst deploy --stage dev --config sst.dev.config.ts
// The dev stage creates wildcard ACM certs. Copy the ARNs from the AWS console.
const WILDCARD_CERT_ALB = 'TODO:WILDCARD_CERT_ALB'
const WILDCARD_CERT_CF = 'TODO:WILDCARD_CERT_CF'

export default $config({
  app() {
    return {
      name: 'zero-app',
      // Change to 'retain' and true for real production use
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
    const dns = sst.cloudflare.dns({
      zone: 'TODO:CLOUDFLARE_ZONE_ID',
    })

    const vpc = new sst.aws.Vpc('Vpc', {
      nat: { type: 'ec2', ec2: { instance: 't4g.micro' } },
      bastion: true,
    })

    const db = new sst.aws.Postgres('Database', {
      vpc,
      dev: {
        username: 'postgres',
        password: new sst.Secret('PostgresPassword', POSTGRES_PASSWORD).value,
        database: 'zero_app',
        port: 5432,
      },
      transform: {
        parameterGroup: {
          parameters: [
            {
              name: 'rds.logical_replication',
              value: '1',
              applyMethod: 'pending-reboot',
            },
          ],
        },
        instance: {
          backupRetentionPeriod: 1,
        },
      },
    })

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
          name: 'api.TODO:DOMAIN',
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
        ZERO_UPSTREAM_DB: $interpolate`postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}`,
        ZERO_QUERY_URL: $interpolate`${api.url}api/zero/query`,
        ZERO_MUTATE_URL: $interpolate`${api.url}api/zero/mutate`,
        ZERO_REPLICA_FILE: '/tmp/zero.db',
        ZERO_LOG_LEVEL: 'info',
      },
      dev: false,
      loadBalancer: {
        domain: {
          name: 'zero.TODO:DOMAIN',
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
        name: 'app.TODO:DOMAIN',
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
