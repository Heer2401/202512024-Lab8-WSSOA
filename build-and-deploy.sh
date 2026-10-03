#!/usr/bin/env bash
# CampusConnect Lab 8 - Automated Build, Load, and Deploy Script (Bash)
# Subject: Web Services & SOA Lab 8 (Roll No: 202512024)

set -e

CLUSTER_TYPE=${1:-"kind"}
CLUSTER_NAME=${2:-"lab8-cluster"}
NAMESPACE=${3:-"lab8"}

echo "=================================================================="
echo "🚀 CampusConnect Lab 8: Kubernetes Build & Deploy Pipeline"
echo "=================================================================="

# 1. Verify Docker Daemon
echo -e "\n[Step 1/5] Checking Docker and kubectl..."
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker daemon is NOT running. Please start Docker first!"
    exit 1
fi

echo "✔ Active Kubernetes Context: $(kubectl config current-context)"

# 2. Build Docker Images
echo -e "\n[Step 2/5] Building Docker Images..."
SERVICES=("api-gateway" "user-service" "product-service" "order-service")

for svc in "${SERVICES[@]}"; do
    echo "🔨 Building image: $svc:v1 ..."
    docker build -t "$svc:v1" -t "$svc:latest" "./$svc"
done
echo "✔ All 4 microservice Docker images built successfully."

# 3. Load Images into Cluster
if [ "$CLUSTER_TYPE" == "kind" ]; then
    echo -e "\n[Step 3/5] Loading Docker images into kind cluster '$CLUSTER_NAME'..."
    for svc in "${SERVICES[@]}"; do
        echo "📦 Loading $svc:v1 into kind..."
        kind load docker-image "$svc:v1" --name "$CLUSTER_NAME" || true
    done
elif [ "$CLUSTER_TYPE" == "minikube" ]; then
    echo -e "\n[Step 3/5] Loading Docker images into minikube..."
    for svc in "${SERVICES[@]}"; do
        minikube image load "$svc:v1"
    done
fi

# 4. Apply Manifests
echo -e "\n[Step 4/5] Applying Kubernetes Manifests into namespace '$NAMESPACE'..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

if [ -f "k8s/kustomization.yaml" ]; then
    kubectl apply -k k8s/
else
    kubectl apply -f k8s/ -n "$NAMESPACE"
    kubectl apply -f k8s/monitoring/ -n "$NAMESPACE"
fi

echo "✔ Kubernetes manifests successfully applied."

# 5. Display Status
echo -e "\n[Step 5/5] Checking Workload Status..."
sleep 3
kubectl get all -n "$NAMESPACE"

echo -e "\n=================================================================="
echo "🎉 Deployment Complete!"
echo "=================================================================="
echo "Next Steps:"
echo "1. Port forward API Gateway: kubectl port-forward svc/api-gateway 8080:8080 -n $NAMESPACE"
echo "2. Port forward Prometheus:  kubectl port-forward svc/prometheus 9090:9090 -n $NAMESPACE"
echo "3. Port forward Grafana:     kubectl port-forward svc/grafana 3000:3000 -n $NAMESPACE"
echo "4. Run verification tests:   node verify_k8s_cluster.js"
echo "5. Run traffic generator:    node generate_traffic.js localhost 8080 50 150"
echo "=================================================================="
