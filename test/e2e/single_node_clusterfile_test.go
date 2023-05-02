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

	"github.com/onsi/gomega/gexec"

	. "github.com/onsi/ginkgo/v2"
	. "github.com/onsi/gomega"

	"github.com/labring/sealos/test/e2e/testhelper"
)

var _ = Describe("single-node-clusterfile test", func() {
	var (
		clusterFile  string
		cmdApplyArgs string
		cmdGenArgs   string
		output       []byte
		err          error
		t            *gexec.Session
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
		cmdApplyArgs = fmt.Sprintf("sudo sealos apply -f %s", clusterFile)
		cmdGenArgs = fmt.Sprintf("sudo sealos gen hub.sealos.cn/labring/kubernetes:v1.25.6 hub.sealos.cn/labring/helm:v3.11.0 hub.sealos.cn/labring/flannel:v0.21.4 -o %s", clusterFile)
	})

	AfterEach(func() {
		// Delete temporary files
		defer testhelper.RemoveTempFile(clusterFile)
	})

	Context("successfully deploy a single-node Kubernetes cluster", func() {
		It("sealos apply single-node Clusterfile", func() {
			By("test run sealos reset", func() {
				t = testhelper.RunCmdAndCheckResult("sudo sealos reset --force", 0)
				output = t.Out.Contents()
				Expect(string(output)).To(ContainSubstring("succeeded in deleting current cluster"))
			})

			By("test run sealos apply", func() {
				// Run the sealos command line tool and capture output and error messages.
				t = testhelper.RunCmdAndCheckResult(cmdApplyArgs, 0)
				output = t.Out.Contents()
				Expect(string(output)).To(ContainSubstring("succeeded in creating a new cluster"))
			})

			By("test run sealos images", func() {
				t = testhelper.RunCmdAndCheckResult("sudo sealos images", 0)
				output = t.Out.Contents()
				Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/kubernetes"))
				Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/flannel"))
				Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/helm"))
			})
		})

		It("sealos gen single-node Clusterfile", func() {
			By("test run sealos reset", func() {
				t = testhelper.RunCmdAndCheckResult("sudo sealos reset --force", 0)
				output = t.Out.Contents()
				Expect(string(output)).To(ContainSubstring("succeeded in deleting current cluster"))
			})

			By("test run sealos gen", func() {
				// Run the sealos command line tool and capture output and error messages.
				testhelper.RunCmdAndCheckResult(cmdGenArgs, 0)
				Expect(testhelper.IsFileExist(clusterFile)).To(BeTrue(), fmt.Sprintf("%s should be created, but not found", clusterFile))
			})

			By("test run sealos apply", func() {
				// Run the sealos command line tool and capture output and error messages.
				t = testhelper.RunCmdAndCheckResult(fmt.Sprintf("sudo sealos apply -f %s", clusterFile), 0)
				output = t.Out.Contents()
				Expect(string(output)).To(ContainSubstring("succeeded in creating a new cluster"))
			})

			By("test run sealos images", func() {
				t = testhelper.RunCmdAndCheckResult("sudo sealos images", 0)
				output = t.Out.Contents()
				Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/kubernetes"))
				Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/flannel"))
				Expect(string(output)).To(ContainSubstring("hub.sealos.cn/labring/helm"))
			})
		})
	})
})
