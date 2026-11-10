package main

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func main() {
	executable, err := os.Executable()
	if err != nil { fail(err); return }
	archive, err := zip.OpenReader(executable)
	if err != nil { fail(fmt.Errorf("installer payload is invalid: %w", err)); return }
	defer archive.Close()
	tempDir, err := os.MkdirTemp("", "mai-telegraf-cpu-")
	if err != nil { fail(err); return }
	defer os.RemoveAll(tempDir)

	for _, file := range archive.File {
		if !strings.HasPrefix(file.Name, "payload/") || file.FileInfo().IsDir() { continue }
		relative := strings.TrimPrefix(file.Name, "payload/")
		destination := filepath.Join(tempDir, filepath.FromSlash(relative))
		if err := os.MkdirAll(filepath.Dir(destination), 0755); err != nil { fail(err); return }
		source, err := file.Open()
		if err != nil { fail(err); return }
		target, err := os.Create(destination)
		if err != nil { source.Close(); fail(err); return }
		_, copyErr := io.Copy(target, source)
		target.Close(); source.Close()
		if copyErr != nil { fail(copyErr); return }
	}

	script := filepath.Join(tempDir, "install.ps1")
	command := exec.Command("powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script)
	command.Stdin, command.Stdout, command.Stderr = os.Stdin, os.Stdout, os.Stderr
	if err := command.Run(); err != nil { fail(err) }
}

func fail(err error) {
	message := strings.ReplaceAll(fmt.Sprintf("MAI plugin installation failed: %v", err), "'", "''")
	_ = exec.Command("powershell.exe", "-NoProfile", "-Command", "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('"+message+"','MAI Installer')").Run()
}
