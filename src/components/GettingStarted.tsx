import { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { FolderOpen, Check } from 'lucide-react';
import { useAppSettingsStore, useAppSettingsHydrated } from '../stores/appSettingsStore';
import { isTauri } from '../utils/platform';
import { basename } from '../utils/paths';

/**
 * First-run setup for the desktop app.
 *
 * Only the image library needs choosing before anything works well, so this
 * asks for that one thing and gets out of the way. It is skippable - the same
 * setting lives in Application Settings - but asking once up front avoids the
 * first MPCFill import failing for a reason that is not obvious.
 */
export function GettingStarted() {
    const libraryFolder = useAppSettingsStore((state) => state.libraryFolder);
    const setLibraryFolder = useAppSettingsStore((state) => state.setLibraryFolder);
    const hasCompletedSetup = useAppSettingsStore((state) => state.hasCompletedSetup);
    const setHasCompletedSetup = useAppSettingsStore((state) => state.setHasCompletedSetup);
    const hydrated = useAppSettingsHydrated();
    const [isChoosing, setIsChoosing] = useState(false);

    // Wait for stored settings before deciding, or returning users see this flash
    // past on every launch.
    if (!isTauri || !hydrated || hasCompletedSetup) return null;

    const handleChoose = async () => {
        setIsChoosing(true);
        try {
            const { open } = await import('@tauri-apps/plugin-dialog');
            const selected = await open({
                directory: true,
                multiple: false,
                title: 'Choose image library folder',
            });
            if (typeof selected === 'string') {
                setLibraryFolder(selected);
            }
        } finally {
            setIsChoosing(false);
        }
    };

    return (
        <Modal
            isOpen
            hideCloseButton
            isDismissable={false}
            size="lg"
            className="border-1"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1">
                    Welcome to ProxKit
                    <span className="text-xs font-normal text-default-500">
                        One quick thing before you start.
                    </span>
                </ModalHeader>

                <ModalBody>
                    <p className="text-sm text-default-600">
                        Choose a folder to keep card images in. Imported artwork is
                        saved there and reused, so the same card is never downloaded
                        twice.
                    </p>
                    <p className="text-sm text-default-600">
                        If you already have a folder of MPC Autofill downloads, pick
                        that one - those files can be used as they are.
                    </p>

                    <div className="flex items-center gap-2 mt-2">
                        <Button
                            variant="ghost"
                            radius="sm"
                            onPress={handleChoose}
                            isLoading={isChoosing}
                            startContent={!isChoosing && <FolderOpen className="w-4 h-4" />}
                        >
                            {libraryFolder ? 'Change folder' : 'Choose folder'}
                        </Button>

                        {libraryFolder && (
                            <span className="flex items-center gap-1 text-sm text-success">
                                <Check className="w-4 h-4" />
                                {basename(libraryFolder)}
                            </span>
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="light"
                        radius="sm"
                        onPress={() => setHasCompletedSetup(true)}
                    >
                        Skip for now
                    </Button>
                    <Button
                        color="success"
                        variant="ghost"
                        radius="sm"
                        isDisabled={!libraryFolder}
                        onPress={() => setHasCompletedSetup(true)}
                    >
                        Get started
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
