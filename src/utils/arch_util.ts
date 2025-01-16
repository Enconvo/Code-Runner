// Function to determine CPU architecture and set appropriate arch value
function getArchitecture(): 'arm' | 'x86' {
    // Check CPU type using process.arch
    const cpuType = process.arch;
    console.log('cpuType:', cpuType);

    // Determine architecture based on CPU type
    if (cpuType === 'arm64' || cpuType === 'arm') {
        // ARM architecture (e.g. Apple Silicon M1/M2)
        return 'arm';
    } else if (cpuType === 'x64' || cpuType === 'ia32') {
        // x86 architecture (e.g. Intel)
        return 'x86';
    }

    // Default to arm if architecture cannot be determined
    return 'arm';
}

// Export the function
export { getArchitecture };
