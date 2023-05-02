/*
Copyright 2023 cuisongliu@qq.com.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package e2e

import (
	"fmt"

	"github.com/labring/sealos/test/e2e/testhelper"
	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"
)

var _ = Describe("single-node-clusterfile test", func() {
	var (
		clusterFile string
		cmdArgs     string
		output      []byte
		err         error
	)

	BeforeEach(func() {
		// Create a temporary file containing the contents of the Clusterfile.
		content := []byte(`apiVersion: apps.sealos.io/v1beta1
kind: Cluster
metadata:
  name: default
spec:
  image:
  - hub.sealos.cn/labring/kubernetes:v1.25.6
  - hub.sealos.cn/labring/helm:v3.11.0
  - hub.sealos.cn/labring/flannel:v0.21.4`)

		clusterFile = testhelper.CreateTempFile()
		err = testhelper.WriteFile(clusterFile, content)
		if err != nil {
			Fail(fmt.Sprintf("Failed to create temporary file %s: %v", clusterFile, err))
		}

		// Set command-line parameters for the sealos command-line tool.
		cmdArgs = fmt.Sprintf("sudo sealos apply -f %s", clusterFile)
	})

	AfterEach(func() {
		// Delete temporary files
		testhelper.RemoveTempFile(clusterFile)
	})

	Context("when applying the Clusterfile", func() {
		It("should successfully deploy a single-node Kubernetes cluster", func() {
			t := testhelper.RunCmdAndCheckResult("sudo sealos reset --force", 0)
			output = t.Out.Contents()
			Expect(string(output)).To(ContainSubstring("succeeded in deleting current cluster"))

			// Run the sealos command line tool and capture output and error messages.
			t = testhelper.RunCmdAndCheckResult(cmdArgs, 0)
			output = t.Out.Contents()
			Expect(string(output)).To(ContainSubstring("succeeded in creating a new cluster"))

			t = testhelper.RunCmdAndCheckResult("sudo sealos images", 0)
			output = t.Out.Contents()
			Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/kubernetes"))
			Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/flannel"))
			Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/helm"))
		})
	})
})
