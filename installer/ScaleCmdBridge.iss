; ScaleCmdBridge Windows Installer Script
; Inno Setup Compiler Script
; Generates: ScaleCmdBridge-Setup-x64.exe

#define MyAppName "ScaleCmdBridge"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "ScaleIT"
#define MyAppURL "https://github.com/tkogut/Bridge_ScaleCmd_Rust"
#define MyAppExeName "ScaleCmdBridge.exe"
#define MyServiceName "ScaleCmdBridge"
#define MyServiceDisplayName "ScaleIT Bridge Service"

[Setup]
; NOTE: The value of AppId uniquely identifies this application. Do not use the same AppId value in installers for other applications.
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=
InfoBeforeFile=
InfoAfterFile=
OutputDir=..\release
OutputBaseFilename=ScaleCmdBridge-Setup-x64
SetupIconFile=
Compression=lzma
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64
; Upgrade support
AppMutex=ScaleCmdBridgeMutex
VersionInfoVersion={#MyAppVersion}
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyServiceDisplayName}
VersionInfoCopyright=Copyright (C) 2025 {#MyAppPublisher}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startmenu"; Description: "Create Start Menu shortcuts"; GroupDescription: "Shortcuts"; Flags: checkedonce

[Files]
; Backend executable (renamed from scaleit-bridge.exe)
Source: "..\src-rust\target\release\scaleit-bridge.exe"; DestDir: "{app}"; DestName: "{#MyAppExeName}"; Flags: ignoreversion
; NSSM executable
Source: "..\installer\nssm\nssm.exe"; DestDir: "{app}"; Flags: ignoreversion
; Frontend files
Source: "..\dist\*"; DestDir: "{app}\web"; Flags: ignoreversion recursesubdirs createallsubdirs
; Service installation scripts
Source: "..\INSTALL-SERVICE.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\UNINSTALL-SERVICE.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\START-SERVICE.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\STOP-SERVICE.bat"; DestDir: "{app}"; Flags: ignoreversion
; Default configuration (will be copied to ProgramData during service installation)
Source: "..\src-rust\config\devices.json"; DestDir: "{app}\config"; Flags: ignoreversion
; Documentation
Source: "..\README.md"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Install and start Windows Service
Filename: "{app}\INSTALL-SERVICE.bat"; Description: "Install and start Windows Service"; Flags: runhidden waituntilterminated; StatusMsg: "Installing Windows Service..."
; Configure firewall
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""{#MyAppName}"" dir=in action=allow protocol=TCP localport={code:GetPort}"; Description: "Configure Windows Firewall"; Flags: runhidden; StatusMsg: "Configuring firewall..."

[UninstallRun]
; Stop and remove service before uninstallation
Filename: "{app}\UNINSTALL-SERVICE.bat"; Flags: runhidden waituntilterminated; RunOnceId: "RemoveService"
; Remove firewall rule
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=""{#MyAppName}"""; Flags: runhidden; RunOnceId: "RemoveFirewall"

[Code]
var
  PortPage: TInputQueryWizardPage;
  Port: Integer;

function CheckPortInUse(PortNum: Integer): Boolean;
var
  TmpFile: String;
  ResultCode: Integer;
begin
  TmpFile := ExpandConstant('{tmp}\portcheck.txt');
  Exec('cmd.exe', '/c netstat -an | findstr ":' + IntToStr(PortNum) + '" > "' + TmpFile + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := FileExists(TmpFile) and (GetFileSize(TmpFile) > 0);
  if FileExists(TmpFile) then
    DeleteFile(TmpFile);
end;

function ServiceExists(): Boolean;
var
  ResultCode: Integer;
begin
  Result := Exec('sc.exe', 'query "{#MyServiceName}"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) and (ResultCode = 0);
end;

function FirewallRuleNotExists(): Boolean;
var
  TmpFile: String;
  ResultCode: Integer;
begin
  TmpFile := ExpandConstant('{tmp}\firewallcheck.txt');
  Exec('netsh.exe', 'advfirewall firewall show rule name="{#MyAppName}" > "' + TmpFile + '"', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Result := not (FileExists(TmpFile) and (GetFileSize(TmpFile) > 0));
  if FileExists(TmpFile) then
    DeleteFile(TmpFile);
end;

function InitializeSetup(): Boolean;
begin
  Result := True;
end;

procedure InitializeWizard();
begin
  // Create custom page for port selection
  PortPage := CreateInputQueryPage(wpSelectTasks,
    'Port Configuration', 'Select the port for the service',
    'Please specify the port number for the ScaleCmdBridge service (default: 8080).' + #13#10 +
    'The installer will check if the port is available.');
  
  PortPage.Add('Port:', False);
  PortPage.Values[0] := '8080';
end;

function GetPort(Param: String): String;
begin
  Result := IntToStr(Port);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
var
  PortStr: String;
  PortNum: Integer;
  PortInUse: Boolean;
begin
  Result := True;
  
  if CurPageID = PortPage.ID then
  begin
    PortStr := PortPage.Values[0];
    
    // Validate port number
    PortNum := StrToIntDef(PortStr, 0);
    if PortNum = 0 then
    begin
      MsgBox('Invalid port number. Please enter a number between 1024 and 65535.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    if (PortNum < 1024) or (PortNum > 65535) then
    begin
      MsgBox('Port number must be between 1024 and 65535.', mbError, MB_OK);
      Result := False;
      Exit;
    end;
    
    // Check if port is in use (simple check using netstat)
    PortInUse := CheckPortInUse(PortNum);
    if PortInUse then
    begin
      if MsgBox('Port ' + IntToStr(PortNum) + ' appears to be in use.' + #13#10 +
                'Do you want to continue anyway?', mbConfirmation, MB_YESNO) = IDNO then
      begin
        Result := False;
        Exit;
      end;
    end;
    
    Port := PortNum;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigFile: String;
  ConfigContent: String;
begin
  if CurStep = ssPostInstall then
  begin
    // Save port to environment variable or config file
    // For now, we'll set it as environment variable for NSSM
    // The INSTALL-SERVICE.bat will read this and configure NSSM accordingly
    SaveStringToFile(ExpandConstant('{app}\port.txt'), IntToStr(Port), False);
  end;
end;

