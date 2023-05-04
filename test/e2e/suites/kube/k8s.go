package kube

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/pkg/errors"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/wait"

	"github.com/labring/sealos/pkg/client-go/kubernetes"
)

type K8s interface {
	GetClusterInfo() (string, error)
	CreateCustomPod(podName, containerName, imageName string, command []string) (*v1.Pod, error)
	GetPod(podName string) (*v1.Pod, error)
	DeletePod(podName string) error
	WaitForServiceAccount(serviceAccount string) error
	WaitForPodRunning(podName string, timeout time.Duration) error
	ListNodes() (*v1.NodeList, error)
	ListNodesByLabel(label string) (*v1.NodeList, error)
	ListNodeIPByLabel(label string) ([]net.IP, error)
	ListResources(gvr schema.GroupVersionResource, namespace string, opts metav1.ListOptions) (*unstructured.UnstructuredList, error)
}

type K8sClient struct {
	//client *kubernetes.Clientset
	Client kubernetes.Client
}

func NewK8sClient(kubeconfig string, apiServer string) (K8s, error) {
	client, err := kubernetes.NewKubernetesClient(kubeconfig, apiServer)
	if err != nil {
		return nil, err
	}

	//config, err := clientcmd.RESTConfigFromKubeConfig(kubeconfig)
	//if err != nil {
	//	return nil, errors.Wrap(err, "failed to build kube config")
	//}
	//
	//clientSet, err := kubernetes.NewForConfig(config)
	//if err != nil {
	//	return nil, err
	//}

	return &K8sClient{
		Client: client,
	}, nil
}

func (c *K8sClient) GetClusterInfo() (string, error) {
	clusterInfo, err := c.Client.Kubernetes().CoreV1().RESTClient().Get().AbsPath("/api/v1").Do(context.Background()).Raw()
	if err != nil {
		return "", errors.Wrapf(err, "failed to get cluster nodes")
	}
	return string(clusterInfo), nil
}

func (c *K8sClient) ListNodes() (*v1.NodeList, error) {
	nodes, err := c.Client.Kubernetes().CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get cluster nodes")
	}
	return nodes, nil
}

func (c *K8sClient) ListNodesByLabel(label string) (*v1.NodeList, error) {
	nodes, err := c.Client.Kubernetes().CoreV1().Nodes().List(context.TODO(), metav1.ListOptions{LabelSelector: label})
	if err != nil {
		return nil, errors.Wrapf(err, "failed to get cluster nodes")
	}
	return nodes, nil
}

func (c *K8sClient) ListNodeIPByLabel(label string) ([]net.IP, error) {
	var ips []net.IP
	nodes, err := c.ListNodesByLabel(label)
	if err != nil {
		return nil, err
	}
	for _, node := range nodes.Items {
		for _, v := range node.Status.Addresses {
			if v.Type == v1.NodeInternalIP {
				ips = append(ips, net.ParseIP(v.Address))
			}
		}
	}
	return ips, nil
}

func (c *K8sClient) ListResources(gvr schema.GroupVersionResource, namespace string, opts metav1.ListOptions) (*unstructured.UnstructuredList, error) {
	resourceClient := c.Client.KubernetesDynamic().Resource(gvr).Namespace(namespace)
	resourceList, err := resourceClient.List(context.TODO(), opts)
	if err != nil {
		return nil, err
	}
	return resourceList, nil
}

func (c *K8sClient) CreateCustomPod(podName, containerName, imageName string, command []string) (*v1.Pod, error) {
	pod := &v1.Pod{
		ObjectMeta: metav1.ObjectMeta{
			Name: podName,
		},
		Spec: v1.PodSpec{
			ServiceAccountName: "default",
			Containers: []v1.Container{
				{
					Name:            containerName,
					Image:           imageName,
					Command:         command,
					ImagePullPolicy: v1.PullIfNotPresent,
				},
			},
			RestartPolicy: v1.RestartPolicyNever,
		},
	}

	createdPod, err := c.Client.Kubernetes().CoreV1().Pods("default").Create(context.Background(), pod, metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	return createdPod, nil
}

func (c *K8sClient) GetPod(podName string) (*v1.Pod, error) {
	pod, err := c.Client.Kubernetes().CoreV1().Pods("default").Get(context.Background(), podName, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return pod, nil
}

func (c *K8sClient) WaitForPodRunning(podName string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timed out waiting for pod %s to be running", podName)
		default:
			pod, err := c.GetPod(podName)
			if err != nil {
				return err
			}
			if pod.Status.Phase == v1.PodRunning {
				return nil
			}
			time.Sleep(time.Second)
		}
	}
}

func (c *K8sClient) DeletePod(podName string) error {
	gracePeriodSeconds := int64(0)
	deletePolicy := metav1.DeletePropagationForeground
	return c.Client.Kubernetes().CoreV1().Pods("default").Delete(context.TODO(), podName, metav1.DeleteOptions{
		GracePeriodSeconds: &gracePeriodSeconds,
		PropagationPolicy:  &deletePolicy,
	})
}

func (c *K8sClient) WaitForServiceAccount(serviceAccount string) error {
	return wait.PollImmediate(time.Second, time.Minute, func() (bool, error) {
		_, err := c.Client.Kubernetes().CoreV1().ServiceAccounts(serviceAccount).Get(context.Background(), "default", metav1.GetOptions{})
		if err != nil {
			return false, nil
		}
		return true, nil
	})
}
