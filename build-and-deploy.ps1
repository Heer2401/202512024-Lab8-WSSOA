# CampusConnect Lab 8 - Automated Build, Load, and Deploy Script (PowerShell)
# Subject: Web Services & SOA Lab 8 (Roll No: 202512024)

param (
    [string]$ClusterType = "kind", # "kind", "docker-desktop", or "minikube"
    [string]$ClusterName = "lab8-cluster",
    [string]$Namespace = "lab8"
)

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "🚀 CampusConnect Lab 8: Kubernetes Build & Deploy Pipeline" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Verify Docker Daemon is running
Write-Host "`n[Step 1/5] Checking Docker and kubectl..." -ForegroundColor Yellow
try {
    docker version | Out-Null
    Write-Host "✔ Docker daemon is running." -ForegroundColor Green
} catch {
    Write-Host "❌ Docker daemon is NOT running. Please start Docker Desktop first!" -ForegroundColor Red
    exit 1
}

# Verify kubectl context
$currentContext = kubectl config current-context
Write-Host "✔ Active Kubernetes Context: $currentContext" -ForegroundColor Green

# 2. Build Docker Images for all 4 microservices
Write-Host "`n[Step 2/5] Building Docker Images..." -ForegroundColor Yellow
$services = @("api-gateway", "user-service", "product-service", "order-service")

foreach ($svc in $services) {
    Write-Host "🔨 Building image: $svc:v1 ..." -ForegroundColor Cyan
    docker build -t "$svc:v1" -t "$svc:latest" "./$svc"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build Docker image for $svc" -ForegroundColor Red
        exit 1
    }
}
Write-Host "✔ All 4 microservice Docker images built successfully." -ForegroundColor Green

# 3. Load Images into Cluster (if using kind or minikube)
if ($ClusterType -eq "kind") {
    Write-Host "`n[Step 3/5] Loading Docker images into kind cluster '$ClusterName'..." -ForegroundColor Yellow
    foreach ($svc in $services) {
        Write-Host "📦 Loading $svc:v1 into kind..." -ForegroundColor Cyan
        kind load docker-image "$svc:v1" --name $ClusterName
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️ Warning: Failed to load into kind '$ClusterName'. If cluster name differs, run: kind load docker-image $svc:v1 --name <your-cluster-name>" -ForegroundColor Yellow
        }
    }
} elseif ($ClusterType -eq "minikube") {
    Write-Host "`n[Step 3/5] Loading Docker images into minikube..." -ForegroundColor Yellow
    foreach ($svc in $services) {
        minikube image load "$svc:v1"
    }
} else {
    Write-Host "`n[Step 3/5] Docker Desktop Kubernetes shares host images automatically." -ForegroundColor Green
}

# 4. Create Namespace and Apply Manifests
Write-Host "`n[Step 4/5] Applying Kubernetes Manifests into namespace '$Namespace'..." -ForegroundColor Yellow
kubectl create namespace $Namespace --dry-run=client -o yaml | kubectl apply -f -

# Apply Kustomize bundle
if (Test-Path "k8s/kustomization.yaml") {
    kubectl apply -k k8s/
} else {
    kubectl apply -f k8s/ -n $Namespace
    kubectl apply -f k8s/monitoring/ -n $Namespace
}

Write-Host "✔ Kubernetes manifests successfully applied." -ForegroundColor Green

# 5. Display Status
Write-Host "`n[Step 5/5] Checking Workload Status..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
kubectl get all -n $Namespace

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "🎉 Deployment Complete!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Port forward API Gateway: kubectl port-forward svc/api-gateway 8080:8080 -n $Namespace"
Write-Host "2. Port forward Prometheus:  kubectl port-forward svc/prometheus 9090:9090 -n $Namespace"
Write-Host "3. Port forward Grafana:     kubectl port-forward svc/grafana 3000:3000 -n $Namespace"
Write-Host "4. Run verification tests:   node verify_k8s_cluster.js"
Write-Host "5. Run traffic generator:    node generate_traffic.js localhost 8080 50 150"
Write-Host "==================================================================" -ForegroundColor Cyan
